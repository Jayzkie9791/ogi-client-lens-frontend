import {apiRequest} from "../api/client";

export const incidentCategories=["INCIDENT_EVENT","SAFETY_INTERVENTION"] as const;
export const incidentTypes=["NEAR_DROWNING","DROWNING","ACTIVE_RESCUE","SPINAL_INJURY","MEDICAL_EMERGENCY","CHOKING","SLIP_TRIP_FALL","LACERATION","BURN","MISSING_PERSON","EQUIPMENT_FAILURE","WATER_CLEARANCE","ENVIRONMENTAL_HAZARD","UNSAFE_BEHAVIOR","RESTRICTED_AREA_ENFORCEMENT","WEATHER_EVACUATION","MARINE_HAZARD","OTHER"] as const;
export const incidentSeverities=["LOW","MODERATE","HIGH","CRITICAL"] as const;

export interface CreateIncidentRequest {
  facility_id:string;
  incident_category:typeof incidentCategories[number];
  incident_type:typeof incidentTypes[number];
  severity:typeof incidentSeverities[number];
  incident_date:string;
  incident_location?:string;
  persons_involved?:number;
  description:string;
  actions_taken?:string;
  emergency_services_contacted?:boolean;
  follow_up_required?:boolean;
}
export interface CreatedIncident {incident_id:string;business_identifier:string;incident_type:string;severity:string;}

export function createIncident(request:CreateIncidentRequest){
  return apiRequest<{success:true;data:CreatedIncident}>("/api/v1/incidents",{method:"POST",body:request,validate:isResponse}).then((response)=>response.data);
}
function object(value:unknown):value is Record<string,unknown>{return value!==null&&typeof value==="object"&&!Array.isArray(value);}
function isResponse(value:unknown):value is {success:true;data:CreatedIncident}{return object(value)&&value.success===true&&object(value.data)&&typeof value.data.incident_id==="string"&&typeof value.data.business_identifier==="string"&&typeof value.data.incident_type==="string"&&typeof value.data.severity==="string";}
