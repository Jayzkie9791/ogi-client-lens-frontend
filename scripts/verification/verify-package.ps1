[CmdletBinding()]
param(
    [ValidateSet(
        "Typecheck",
        "Lint",
        "FocusedTests",
        "Build",
        "FullSuite",
        "GitDiffCheck",
        "StagedDiffCheck",
        "StagedNameOnly",
        "StagedStat",
        "GitStatus"
    )]
    [string]$StartAt
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# Permanent verification infrastructure only. Package-specific test targets live
# in the ignored manifest. This script never installs dependencies, writes the
# manifest, stages files, changes Git configuration, or invokes backend/database
# commands. -StartAt is a remediation resume aid; callers must select the earliest
# gate affected by their change.

$script:ScriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:RepositoryRoot = (Resolve-Path (Join-Path $script:ScriptDirectory "..\..")).Path
$script:ReportDirectory = Join-Path $script:RepositoryRoot "tmp\verification"
$script:ManifestPath = Join-Path $script:ReportDirectory "package-manifest.txt"
$script:ReportPath = Join-Path $script:ReportDirectory "latest-verification.txt"
$script:GateOrder = @(
    "Typecheck",
    "Lint",
    "FocusedTests",
    "Build",
    "FullSuite",
    "GitDiffCheck",
    "StagedDiffCheck",
    "StagedNameOnly",
    "StagedStat",
    "GitStatus"
)
$script:GateResults = [ordered]@{}
$script:StoppedAt = $null
$script:Manifest = $null

if (-not (Test-Path -LiteralPath $script:ReportDirectory -PathType Container)) {
    New-Item -ItemType Directory -Path $script:ReportDirectory -Force | Out-Null
}
Set-Content -LiteralPath $script:ReportPath -Value "" -Encoding UTF8

function Write-Log {
    param([AllowEmptyString()][string]$Message = "")

    Write-Host $Message
    Add-Content -LiteralPath $script:ReportPath -Value $Message -Encoding UTF8
}

function Convert-ToDisplayArgument {
    param([string]$Argument)

    if ($Argument -match '[\s"]') {
        return '"' + ($Argument -replace '"', '\"') + '"'
    }
    return $Argument
}

function Convert-ToGateLabel {
    param([string]$Name)

    return (($Name -creplace '(?<=[a-z0-9])(?=[A-Z])', '_').ToUpperInvariant())
}

function Invoke-NativeCapture {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    $displayArguments = @($Arguments | ForEach-Object { Convert-ToDisplayArgument $_ })
    Write-Log ("> {0} {1}" -f $FilePath, ($displayArguments -join " "))

    $captured = New-Object System.Collections.Generic.List[string]
    & $FilePath @Arguments 2>&1 | ForEach-Object {
        $line = $_.ToString()
        [void]$captured.Add($line)
        Write-Log $line
    }
    $nativeExitCode = $LASTEXITCODE

    return [pscustomobject]@{
        ExitCode = $nativeExitCode
        Output = ($captured -join [Environment]::NewLine)
    }
}

function Invoke-RequiredNativeGate {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    $result = Invoke-NativeCapture -FilePath $FilePath -Arguments $Arguments
    if ($result.ExitCode -ne 0) {
        throw "Native command exited with code $($result.ExitCode)."
    }
}

function Read-PackageManifest {
    if (-not (Test-Path -LiteralPath $script:ManifestPath -PathType Leaf)) {
        throw "Manifest not found: $script:ManifestPath"
    }

    $package = $null
    $packageCount = 0
    $focusedHeaderCount = 0
    $insideFocusedTests = $false
    $patterns = New-Object System.Collections.Generic.List[string]

    foreach ($rawLine in @(Get-Content -LiteralPath $script:ManifestPath)) {
        $line = $rawLine.Trim()
        if ($line.Length -eq 0 -or $line.StartsWith("#")) {
            continue
        }

        if ($line -eq "FOCUSED_TESTS:") {
            $focusedHeaderCount++
            if ($focusedHeaderCount -gt 1) {
                throw "Malformed manifest: duplicate FOCUSED_TESTS header."
            }
            $insideFocusedTests = $true
            continue
        }

        if ($line -match '^PACKAGE=(.*)$') {
            if ($insideFocusedTests) {
                throw "Malformed manifest: PACKAGE cannot appear after FOCUSED_TESTS."
            }
            $packageCount++
            if ($packageCount -gt 1) {
                throw "Malformed manifest: duplicate PACKAGE."
            }
            $package = $Matches[1].Trim()
            continue
        }

        if (-not $insideFocusedTests) {
            throw "Malformed manifest line: $line"
        }
        if ($line -match '^[A-Z_]+(?:=|:)' ) {
            throw "Malformed manifest: unsupported field or section in FOCUSED_TESTS: $line"
        }
        [void]$patterns.Add($line)
    }

    if ($packageCount -ne 1 -or [string]::IsNullOrWhiteSpace($package)) {
        throw "Malformed manifest: PACKAGE must appear exactly once and be non-empty."
    }
    if ($focusedHeaderCount -ne 1 -or $patterns.Count -eq 0) {
        throw "Malformed manifest: FOCUSED_TESTS is required and must be non-empty."
    }

    return [pscustomobject]@{
        Package = $package
        FocusedPatterns = @($patterns)
    }
}

function Resolve-FocusedTests {
    param([Parameter(Mandatory = $true)][string[]]$Patterns)

    $resolved = [System.Collections.Generic.Dictionary[string, string]]::new(
        [StringComparer]::OrdinalIgnoreCase
    )
    $repositoryPrefix = $script:RepositoryRoot + [System.IO.Path]::DirectorySeparatorChar

    foreach ($pattern in $Patterns) {
        if (
            [System.IO.Path]::IsPathRooted($pattern) -or
            $pattern -match '^[A-Za-z]:' -or
            $pattern -match '^[^\\/]+::'
        ) {
            throw "Focused test patterns must be repository-relative: $pattern"
        }

        $segments = $pattern -split '[\\/]'
        if ($segments -contains "..") {
            throw "Focused test patterns cannot escape the repository: $pattern"
        }

        $nativePattern = $pattern.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
        $candidatePattern = Join-Path $script:RepositoryRoot $nativePattern
        $matches = @(Get-ChildItem -Path $candidatePattern -File -ErrorAction SilentlyContinue)
        if ($matches.Count -eq 0) {
            throw "Focused test pattern matched nothing: $pattern"
        }

        foreach ($match in $matches) {
            $fullPath = $match.FullName
            if (-not $fullPath.StartsWith($repositoryPrefix, [StringComparison]::OrdinalIgnoreCase)) {
                throw "Focused test resolved outside the repository: $pattern"
            }
            $relativePath = $fullPath.Substring($repositoryPrefix.Length).Replace('\', '/')
            $resolved[$relativePath] = $relativePath
        }
    }

    $ordered = [string[]]@($resolved.Values)
    [Array]::Sort($ordered, [StringComparer]::OrdinalIgnoreCase)
    return $ordered
}

function Invoke-Gate {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )

    Write-Log ""
    Write-Log ("GATE = {0}" -f $Name)
    try {
        & $Action
        $script:GateResults[$Name] = "PASS"
        Write-Log ("{0} = PASS" -f (Convert-ToGateLabel $Name))
    }
    catch {
        $script:GateResults[$Name] = "FAIL"
        $script:StoppedAt = $Name
        Write-Log ("ERROR = {0}" -f $_.Exception.Message)
        Write-Log ("{0} = FAIL" -f (Convert-ToGateLabel $Name))
        throw
    }
}

function Invoke-RequiredGitDiffCheck {
    param([switch]$Cached)

    $arguments = @("diff")
    if ($Cached) {
        $arguments += "--cached"
    }
    $arguments += "--check"
    Write-Log ("> git {0}" -f ($arguments -join " "))

    $capturedOutput = @(& git @arguments 2>&1)
    $gitExitCode = $LASTEXITCODE
    $autocrlfAdvisory = "^warning: in the working copy of '.+', LF will be replaced by CRLF the next time Git touches it$"
    foreach ($item in $capturedOutput) {
        $line = $item.ToString()
        if ($line -cnotmatch $autocrlfAdvisory) {
            Write-Log $line
        }
    }

    if ($gitExitCode -ne 0) {
        throw "Native command exited with code $gitExitCode."
    }
}

function Write-FinalSummary {
    param([Parameter(Mandatory = $true)][bool]$Succeeded)

    $packageName = if ($null -ne $script:Manifest) {
        $script:Manifest.Package
    }
    else {
        "UNAVAILABLE"
    }

    Write-Log ""
    Write-Log "=================================================="
    Write-Log "CLIENT LENS FRONTEND VERIFICATION RESULT"
    Write-Log "=================================================="
    Write-Log ("PACKAGE                 {0}" -f $packageName)
    Write-Log ""
    foreach ($gate in $script:GateOrder) {
        $result = if ($script:GateResults.Contains($gate)) {
            $script:GateResults[$gate]
        }
        else {
            "SKIPPED"
        }
        Write-Log ("{0,-23} {1}" -f (Convert-ToGateLabel $gate), $result)
    }
    if ($script:StoppedAt) {
        Write-Log ""
        Write-Log ("STOPPED_AT = {0}" -f (Convert-ToGateLabel $script:StoppedAt))
    }
    Write-Log ""
    Write-Log "RESULT ="
    Write-Log $(if ($Succeeded) {
        "FRONTEND_VERIFICATION_GATE_PASSED"
    }
    else {
        "FRONTEND_VERIFICATION_GATE_FAILED"
    })
    Write-Log "=================================================="
}

Push-Location $script:RepositoryRoot
try {
    $script:Manifest = Read-PackageManifest
    $focusedTests = Resolve-FocusedTests -Patterns $script:Manifest.FocusedPatterns

    $branchResult = Invoke-NativeCapture -FilePath "git" -Arguments @("branch", "--show-current")
    if ($branchResult.ExitCode -ne 0) {
        throw "Unable to read baseline branch."
    }
    $headResult = Invoke-NativeCapture -FilePath "git" -Arguments @("rev-parse", "HEAD")
    if ($headResult.ExitCode -ne 0) {
        throw "Unable to read baseline HEAD."
    }

    Write-Log ""
    Write-Log ("TIMESTAMP = {0}" -f (Get-Date).ToString("o"))
    Write-Log ("PACKAGE = {0}" -f $script:Manifest.Package)
    Write-Log ("BASELINE_BRANCH = {0}" -f $branchResult.Output.Trim())
    Write-Log ("BASELINE_HEAD = {0}" -f $headResult.Output.Trim())
    Write-Log ("FOCUSED_TEST_TARGETS = {0}" -f ($focusedTests -join ", "))

    $startIndex = 0
    if ($StartAt) {
        $startIndex = [array]::IndexOf($script:GateOrder, $StartAt)
        if ($startIndex -lt 0) {
            throw "Invalid StartAt '$StartAt'. Valid gates: $($script:GateOrder -join ', ')"
        }
        Write-Log ("RESUMING_AT = {0}" -f $StartAt)
        Write-Log "Earlier gates are marked SKIPPED and were not executed."
    }

    for ($index = $startIndex; $index -lt $script:GateOrder.Count; $index++) {
        $gate = $script:GateOrder[$index]
        switch ($gate) {
            "Typecheck" {
                Invoke-Gate $gate { Invoke-RequiredNativeGate "npm.cmd" @("run", "typecheck") }
            }
            "Lint" {
                Invoke-Gate $gate { Invoke-RequiredNativeGate "npm.cmd" @("run", "lint") }
            }
            "FocusedTests" {
                Invoke-Gate $gate {
                    $arguments = @("test", "--") + $focusedTests
                    Write-Log ("FOCUSED_TEST_COMMAND = npm.cmd {0}" -f (($arguments | ForEach-Object { Convert-ToDisplayArgument $_ }) -join " "))
                    Invoke-RequiredNativeGate "npm.cmd" $arguments
                }
            }
            "Build" {
                Invoke-Gate $gate { Invoke-RequiredNativeGate "npm.cmd" @("run", "build") }
            }
            "FullSuite" {
                Invoke-Gate $gate { Invoke-RequiredNativeGate "npm.cmd" @("test") }
            }
            "GitDiffCheck" {
                Invoke-Gate $gate { Invoke-RequiredGitDiffCheck }
            }
            "StagedDiffCheck" {
                Invoke-Gate $gate { Invoke-RequiredGitDiffCheck -Cached }
            }
            "StagedNameOnly" {
                Invoke-Gate $gate { Invoke-RequiredNativeGate "git" @("diff", "--cached", "--name-only") }
            }
            "StagedStat" {
                Invoke-Gate $gate { Invoke-RequiredNativeGate "git" @("diff", "--cached", "--stat") }
            }
            "GitStatus" {
                Invoke-Gate $gate { Invoke-RequiredNativeGate "git" @("status", "--short", "--branch") }
            }
            default {
                throw "Internal error: no implementation for gate $gate."
            }
        }
    }

    Write-FinalSummary -Succeeded $true
    exit 0
}
catch {
    if (-not $script:StoppedAt) {
        $script:StoppedAt = "Preflight"
        Write-Log ""
        Write-Log ("ERROR = {0}" -f $_.Exception.Message)
    }
    Write-FinalSummary -Succeeded $false
    exit 1
}
finally {
    Pop-Location
}
