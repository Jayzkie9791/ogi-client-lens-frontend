import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { isApiError } from "../../api/errors";
import { activateClientPocInvitation,activatePersonnelAccount,activatePersonnelRegistration } from "../../auth/authApi";
import { routes } from "../routePaths";

const invalidMessage="This activation link is invalid, expired, already used, or the information provided could not be verified. Request a new activation link from your administrator.";
const serviceMessage="Client Lens could not complete activation right now. Please try again.";
const input="mt-2 min-h-12 w-full rounded-lg border border-blue-200 bg-blue-50/70 px-4 outline-none focus:border-focus focus:ring-2 focus:ring-focus";

export function PersonnelAccountActivationPage(){
  const[params]=useSearchParams(),navigate=useNavigate();
  const mode=useRef(params.has("client_poc_token")?"CLIENT_POC":params.has("registration_token")?"LIFEGUARD_REGISTRATION":"PERSONNEL");
  const token=useRef(params.get("client_poc_token")??params.get("registration_token")??params.get("token")??"");
  const[employeeNumber,setEmployeeNumber]=useState("");
  const[email,setEmail]=useState("");
  const[password,setPassword]=useState("");
  const[confirmation,setConfirmation]=useState("");
  const[error,setError]=useState<string|null>(null);
  const[busy,setBusy]=useState(false);

  useEffect(()=>{if(params.has("token")||params.has("registration_token")||params.has("client_poc_token"))navigate(routes.activatePersonnelAccount,{replace:true});},[navigate,params]);

  async function submit(event:FormEvent){event.preventDefault();setError(null);
    const employee=employeeNumber.trim(),confirmedEmail=email.trim();
    if(!token.current||(mode.current==="CLIENT_POC"?!confirmedEmail:!employee)){setError(invalidMessage);return;}
    if(password.length<8){setError("Password must contain at least 8 characters.");return;}
    if(password!==confirmation){setError("Passwords do not match.");return;}
    setBusy(true);
    try{if(mode.current==="CLIENT_POC")await activateClientPocInvitation({token:token.current,email:confirmedEmail,new_password:password,confirm_password:confirmation});
      else {const request={token:token.current,client_employee_number:employee,new_password:password,confirm_password:confirmation};await (mode.current==="LIFEGUARD_REGISTRATION"?activatePersonnelRegistration(request):activatePersonnelAccount(request));}
      token.current="";setEmployeeNumber("");setEmail("");setPassword("");setConfirmation("");
      navigate(routes.login,{replace:true,state:{personnelAccountActivated:true}});
    }catch(caught){setError(!isApiError(caught)||caught.status>=500?serviceMessage:invalidMessage);}
    finally{setBusy(false);}
  }

  return <main className="relative min-h-screen overflow-hidden bg-cover bg-center bg-no-repeat px-5 py-8 sm:px-8 lg:bg-contain lg:bg-bottom"
    style={{backgroundImage:"url('/brand/LoginBackround.png')"}} data-testid="personnel-activation-page">
    <div className="absolute inset-0 bg-gradient-to-r from-white/45 via-blue-50/40 to-white/70" aria-hidden="true"/>
    <section className="relative mx-auto mt-[5vh] w-full max-w-lg rounded-[1rem] border border-white/80 bg-white/[0.9] p-7 shadow-panel backdrop-blur-md sm:p-10" aria-labelledby="activation-heading">
      <p className="text-sm font-semibold uppercase tracking-wide text-primary-blue">Secure access</p>
      <h1 id="activation-heading" className="mt-2 text-3xl font-semibold text-primary-navy">{mode.current==="CLIENT_POC"?"Complete your Client POC registration":mode.current==="LIFEGUARD_REGISTRATION"?"Complete your Client Lens registration":"Activate your Client Lens account"}</h1>
      <p className="mt-3 text-sm leading-6 text-text-muted">{mode.current==="CLIENT_POC"?"Confirm the invited business email and choose the password you will use to sign in.":mode.current==="LIFEGUARD_REGISTRATION"?"Enter your employee number and choose the password you will use to sign in.":"Verify your Personnel record and choose the password you will use to sign in."}</p>
      <form className="mt-7 space-y-5" onSubmit={submit}>
        {mode.current==="CLIENT_POC"?<div><label className="font-semibold text-primary-navy" htmlFor="activation-email">Invited business email</label><input id="activation-email" className={input} autoComplete="email" type="email" value={email} onChange={event=>setEmail(event.target.value)}/></div>:
        <div><label className="font-semibold text-primary-navy" htmlFor="activation-employee-number">Employee number</label><input id="activation-employee-number" className={input} autoComplete="off" value={employeeNumber} onChange={event=>setEmployeeNumber(event.target.value)}/></div>}
        <div><label className="font-semibold text-primary-navy" htmlFor="activation-password">New password</label>
          <input id="activation-password" className={input} type="password" autoComplete="new-password" value={password} onChange={event=>setPassword(event.target.value)}/></div>
        <div><label className="font-semibold text-primary-navy" htmlFor="activation-confirmation">Confirm new password</label>
          <input id="activation-confirmation" className={input} type="password" autoComplete="new-password" value={confirmation} onChange={event=>setConfirmation(event.target.value)}/></div>
        {error?<p role="alert" className="rounded-component border border-state-error bg-red-50 px-3 py-2 text-sm text-state-error">{error}</p>:null}
        <button className="min-h-12 w-full rounded-lg bg-primary-blue px-4 font-semibold text-white hover:bg-primary-navy disabled:cursor-not-allowed disabled:opacity-70" disabled={busy} type="submit">
          {busy?"Activating...":"Activate account"}
        </button>
        <Link className="block text-center text-sm font-semibold text-primary-blue" to={routes.login}>Return to Sign In</Link>
      </form>
    </section>
  </main>;
}

export const personnelActivationInvalidMessage=invalidMessage;
