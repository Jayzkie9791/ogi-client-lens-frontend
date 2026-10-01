import { render,screen,waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter,Route,Routes,useLocation } from "react-router-dom";
import { beforeEach,expect,it,vi } from "vitest";
import { activateClientPocInvitation,activatePersonnelAccount,activatePersonnelRegistration } from "../../auth/authApi";
import { PersonnelAccountActivationPage,personnelActivationInvalidMessage } from "./PersonnelAccountActivationPage";
import { LoginPage } from "./LoginPage";
import { ApiError } from "../../api/errors";

vi.mock("../../auth/authApi",()=>({activatePersonnelAccount:vi.fn(),activatePersonnelRegistration:vi.fn(),activateClientPocInvitation:vi.fn()}));
vi.mock("../../auth/useAuth",()=>({useAuth:()=>({status:"unauthenticated",clearAuthError:vi.fn(),errorMessage:null,login:vi.fn()})}));
beforeEach(()=>{vi.mocked(activatePersonnelAccount).mockReset();vi.mocked(activatePersonnelRegistration).mockReset();vi.mocked(activateClientPocInvitation).mockReset();localStorage.clear();sessionStorage.clear();});

function renderPage(token=`a`.repeat(43)){render(<MemoryRouter initialEntries={[`/activate-personnel-account?token=${token}`]}><LocationProbe/><Routes>
  <Route path="/activate-personnel-account" element={<PersonnelAccountActivationPage/>}/><Route path="/login" element={<LoginPage/>}/>
</Routes></MemoryRouter>);}

it("captures the token in memory and removes it from the visible URL",async()=>{renderPage();
  await waitFor(()=>expect(screen.getByTestId("current-location")).toHaveTextContent("/activate-personnel-account"));
  expect(screen.getByTestId("current-location")).not.toHaveTextContent("token=");expect(localStorage.length).toBe(0);expect(sessionStorage.length).toBe(0);
});

it("validates employee number and matching password before submission",async()=>{renderPage();const user=userEvent.setup();
  await user.click(screen.getByRole("button",{name:"Activate account"}));expect(screen.getByRole("alert")).toHaveTextContent(personnelActivationInvalidMessage);
  await user.type(screen.getByLabelText("Employee number")," EMP-1 ");await user.type(screen.getByLabelText("New password"),"password1");
  await user.type(screen.getByLabelText("Confirm new password"),"different");await user.click(screen.getByRole("button",{name:"Activate account"}));
  expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match.");expect(activatePersonnelAccount).not.toHaveBeenCalled();
});

it("submits the exact request and redirects to login with a success banner",async()=>{vi.mocked(activatePersonnelAccount).mockResolvedValue({activated:true});renderPage();const user=userEvent.setup();
  await user.type(screen.getByLabelText("Employee number")," EMP-1 ");await user.type(screen.getByLabelText("New password"),"password1");
  await user.type(screen.getByLabelText("Confirm new password"),"password1");await user.click(screen.getByRole("button",{name:"Activate account"}));
  expect(activatePersonnelAccount).toHaveBeenCalledWith({token:"a".repeat(43),client_employee_number:"EMP-1",new_password:"password1",confirm_password:"password1"});
  expect(await screen.findByText("Your account is ready. Sign in with your new password.")).toBeInTheDocument();
  expect(screen.getByTestId("current-location")).toHaveTextContent("/login");expect(screen.getByTestId("current-location")).not.toHaveTextContent("token=");
});

it("completes invite-first registration through the separate atomic endpoint",async()=>{vi.mocked(activatePersonnelRegistration).mockResolvedValue({activated:true});
  render(<MemoryRouter initialEntries={[`/activate-personnel-account?registration_token=${"r".repeat(43)}`]}><LocationProbe/><Routes>
    <Route path="/activate-personnel-account" element={<PersonnelAccountActivationPage/>}/><Route path="/login" element={<LoginPage/>}/>
  </Routes></MemoryRouter>);const user=userEvent.setup();
  expect(screen.getByRole("heading",{name:"Complete your Client Lens registration"})).toBeInTheDocument();
  await user.type(screen.getByLabelText("Employee number"),"EMP-2");await user.type(screen.getByLabelText("New password"),"password1");
  await user.type(screen.getByLabelText("Confirm new password"),"password1");await user.click(screen.getByRole("button",{name:"Activate account"}));
  expect(activatePersonnelRegistration).toHaveBeenCalledWith({token:"r".repeat(43),client_employee_number:"EMP-2",new_password:"password1",confirm_password:"password1"});
  expect(activatePersonnelAccount).not.toHaveBeenCalled();expect(await screen.findByText("Your account is ready. Sign in with your new password.")).toBeInTheDocument();
});

it("keeps activation failures opaque",async()=>{vi.mocked(activatePersonnelAccount).mockRejectedValue(new ApiError({status:400,code:"SECRET_REASON",message:"sensitive detail"}));renderPage();const user=userEvent.setup();
  await user.type(screen.getByLabelText("Employee number"),"EMP-1");await user.type(screen.getByLabelText("New password"),"password1");
  await user.type(screen.getByLabelText("Confirm new password"),"password1");await user.click(screen.getByRole("button",{name:"Activate account"}));
  expect(await screen.findByRole("alert")).toHaveTextContent(personnelActivationInvalidMessage);expect(screen.queryByText("SECRET_REASON")).not.toBeInTheDocument();
});

it("presents network failures as retryable without leaking details",async()=>{vi.mocked(activatePersonnelAccount).mockRejectedValue(new Error("connection secret"));renderPage();const user=userEvent.setup();
  await user.type(screen.getByLabelText("Employee number"),"EMP-1");await user.type(screen.getByLabelText("New password"),"password1");
  await user.type(screen.getByLabelText("Confirm new password"),"password1");await user.click(screen.getByRole("button",{name:"Activate account"}));
  expect(await screen.findByRole("alert")).toHaveTextContent("Client Lens could not complete activation right now. Please try again.");
  expect(screen.queryByText("connection secret")).not.toBeInTheDocument();
});

it("activates an invited Client POC with email confirmation and a recipient-selected password",async()=>{
  vi.mocked(activateClientPocInvitation).mockResolvedValue({activated:true});
  render(<MemoryRouter initialEntries={[`/activate-personnel-account?client_poc_token=${"c".repeat(43)}`]}><LocationProbe/><Routes>
    <Route path="/activate-personnel-account" element={<PersonnelAccountActivationPage/>}/><Route path="/login" element={<LoginPage/>}/>
  </Routes></MemoryRouter>);const user=userEvent.setup();
  expect(screen.getByRole("heading",{name:"Complete your Client POC registration"})).toBeInTheDocument();
  expect(screen.queryByLabelText("Employee number")).not.toBeInTheDocument();
  await user.type(screen.getByLabelText("Invited business email"),"poc@example.com");
  await user.type(screen.getByLabelText("New password"),"password1");await user.type(screen.getByLabelText("Confirm new password"),"password1");
  await user.click(screen.getByRole("button",{name:"Activate account"}));
  expect(activateClientPocInvitation).toHaveBeenCalledWith({token:"c".repeat(43),email:"poc@example.com",new_password:"password1",confirm_password:"password1"});
  expect(await screen.findByText("Your account is ready. Sign in with your new password.")).toBeInTheDocument();
});

function LocationProbe(){const location=useLocation();return <output data-testid="current-location">{`${location.pathname}${location.search}`}</output>;}
