import {readFileSync} from "node:fs";
import {join} from "node:path";
import {expect,it} from "vitest";

const source=readFileSync(join(process.cwd(),"src/registration/PersonnelRegistrationPage.tsx"),"utf8");

it("exposes invite-first registration only under the complete governed permission intersection",()=>{
  expect(source).toContain("<InviteLifeguardPanel");
  expect(source).toContain('auth.canUsePermission("manage_personnel_account_activation")');
  expect(source).toContain('auth.canUsePermission("create_staff_member")');
  expect(source).toContain('auth.canUsePermission("create_facility_assignment")');
  expect(source).toContain('auth.canUsePermission("create_user")');
  expect(source).toContain("canInviteNewLifeguard ? <Surface><InviteLifeguardPanel");
});
