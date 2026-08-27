import { createClient } from "npm:@supabase/supabase-js@2";

const timeZone = "Europe/London";
type Booking = { id:string; client_id:string|null; status:string; email_notifications_enabled:boolean; booking_type:string; block_session_count:number|null; block_date_pattern:string|null; block_frequency:string|null; exact_block_dates:unknown; session_type:string; session_format:string; preferred_date:string; preferred_time:string; first_name:string|null; second_first_name:string|null; email:string; zoom_join_url:string|null };
type Occurrence = { date:string; time:string; format:string };
type Database = ReturnType<typeof createClient>;
const bookingFields = "id,client_id,status,email_notifications_enabled,booking_type,block_session_count,block_date_pattern,block_frequency,exact_block_dates,session_type,session_format,preferred_date,preferred_time,first_name,second_first_name,email,zoom_join_url";

function respond(body:unknown, status=200) { return new Response(JSON.stringify(body), { status, headers:{"Content-Type":"application/json"} }); }
function londonParts(date=new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hourCycle:"h23" }).formatToParts(date);
  const part = (type:string) => parts.find((item) => item.type === type)?.value || "";
  return { date:`${part("year")}-${part("month")}-${part("day")}`, hour:Number(part("hour")), minute:Number(part("minute")) };
}
function addDays(date:string, days:number) { const value=new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate()+days); return value.toISOString().slice(0,10); }
function time(value:unknown) { return String(value || "").slice(0,5); }
function occurrences(booking:Booking):Occurrence[] {
  const first={date:booking.preferred_date,time:time(booking.preferred_time),format:booking.session_format};
  if (booking.booking_type !== "Block booking") return [first];
  if (booking.block_date_pattern === "Flexible dates" && Array.isArray(booking.exact_block_dates)) {
    const exact=booking.exact_block_dates.filter((item):item is Record<string,unknown>=>Boolean(item&&typeof item==="object")).map((item)=>({date:String(item.date||""),time:time(item.time),format:String(item.format||booking.session_format)})).filter((item)=>/^\d{4}-\d{2}-\d{2}$/.test(item.date)&&/^\d{2}:\d{2}$/.test(item.time));
    if (exact.length) return exact;
  }
  if (booking.block_date_pattern === "Regular pattern") {
    const count=Math.min(Math.max(Number(booking.block_session_count)||1,1),20), gap=booking.block_frequency==="Fortnightly"?14:7;
    return Array.from({length:count},(_,index)=>({...first,date:addDays(first.date,gap*index)}));
  }
  return [first];
}
function displayDate(date:string) { return new Intl.DateTimeFormat("en-GB",{timeZone,weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date(`${date}T12:00:00Z`)); }
function details(format:string, zoomLink="") {
  if (format === "In person") return "in person at Cherry Tree Therapy Centre, Henley-on-Thames";
  if (format === "Telephone call") return "by telephone";
  if (["Online","Zoom call"].includes(format)) return zoomLink ? `by Zoom. Your joining link is: ${zoomLink}` : "online, using your agreed joining details";
  return String(format||"using the agreed format").toLowerCase();
}
function greeting(booking:Booking) { const names=[booking.first_name,booking.second_first_name].map((name)=>String(name||"").trim()).filter(Boolean); return names.length?`Hi ${names.join(" and ")},`:"Hello,"; }
function reminderMessage(booking:Booking, occurrence:Occurrence) { return { subject:`Reminder: your session with Ayesha tomorrow at ${occurrence.time}`, text:[greeting(booking),"",`Just a courtesy reminder that your session with me is tomorrow, ${displayDate(occurrence.date)}, at ${occurrence.time}, ${details(occurrence.format)}.`,"","If you need to contact me about the appointment or make any changes, please reply to this email. As agreed, sessions cancelled or rearranged with less than 48 hours’ notice would need to be charged at the usual session fee.","","Warm wishes,","Ayesha"].join("\n") }; }
function confirmationMessage(booking:Booking) {
  const items=occurrences(booking), lines=items.map((item)=>`• ${displayDate(item.date)} at ${item.time}, ${details(item.format,booking.zoom_join_url||"")}`);
  return { subject:items.length>1?"Your sessions with Ayesha are confirmed":"Your session with Ayesha is confirmed", text:[greeting(booking),"",items.length>1?"Confirming your sessions with me:":"Confirming your session with me:","",...lines,"","If you need to contact me about the appointment or make any changes, please reply to this email. As agreed, sessions cancelled or rearranged with less than 48 hours’ notice would need to be charged at the usual session fee.","","Warm wishes,","Ayesha"].join("\n") };
}
async function send(to:string, subject:string, text:string) {
  const apiKey=Deno.env.get("RESEND_API_KEY")||""; if(!apiKey) throw new Error("RESEND_API_KEY is not configured.");
  const result=await fetch("https://api.resend.com/emails",{method:"POST",signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({from:Deno.env.get("APPOINTMENT_REMINDER_FROM")||"Ayesha Jane <info@ayeshajane.com>",reply_to:Deno.env.get("APPOINTMENT_REMINDER_REPLY_TO")||"info@ayeshajane.com",to:[to],subject,text})});
  const body=await result.json().catch(()=>({})); if(!result.ok) throw new Error(`Resend returned ${result.status}: ${JSON.stringify(body).slice(0,300)}`); return String(body.id||"");
}
async function loadBooking(db:Database,id:string) { const {data,error}=await db.from("booking_requests").select(bookingFields).eq("id",id).maybeSingle(); if(error||!data) throw new Error("Booking not found."); return data as Booking; }
async function recipients(db:Database, booking:Booking) {
  let emails:string[]=[];
  if(booking.client_id){const {data}=await db.from("clients").select("email,second_email").eq("id",booking.client_id).maybeSingle(); emails=[data?.email,data?.second_email].filter(Boolean) as string[];}
  if(!emails.length) emails=[booking.email];
  return [...new Set(emails.map((email)=>String(email||"").trim().toLowerCase()))].filter((email)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}
async function adminUser(request:Request,db:Database) { const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||""; const {data}=await db.auth.getUser(token); if(!data.user)return null; const {data:member}=await db.from("admin_users").select("user_id").eq("user_id",data.user.id).maybeSingle(); return member?data.user:null; }
async function sendConfirmation(db:Database,booking:Booking,to:string[]) {
  const message=confirmationMessage(booking); let sent=0;
  for(const email of to){
    const {data:old}=await db.from("booking_confirmation_deliveries").select("id,status,attempt_count").eq("booking_id",booking.id).eq("recipient_email",email).maybeSingle(); if(old?.status==="sent")continue;
    const delivery={booking_id:booking.id,recipient_email:email,status:"processing",attempt_count:Number(old?.attempt_count||0)+1,last_error:null,updated_at:new Date().toISOString()};
    const saved=old?await db.from("booking_confirmation_deliveries").update(delivery).eq("id",old.id).select("id").single():await db.from("booking_confirmation_deliveries").insert(delivery).select("id").single(); if(saved.error||!saved.data)throw saved.error||new Error("Could not reserve email delivery.");
    try{const messageId=await send(email,message.subject,message.text);await db.from("booking_confirmation_deliveries").update({status:"sent",provider_message_id:messageId||null,sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",saved.data.id);sent++;}
    catch(error){const detail=error instanceof Error?error.message:String(error);await db.from("booking_confirmation_deliveries").update({status:"failed",last_error:detail.slice(0,1000),updated_at:new Date().toISOString()}).eq("id",saved.data.id);throw error;}
  }
  await db.from("booking_requests").update({email_notifications_enabled:true}).eq("id",booking.id); return sent;
}

Deno.serve(async(request)=>{
  if(request.method!=="POST")return respond({error:"Method not allowed"},405);
  try{
    const body=await request.json().catch(()=>({})), url=Deno.env.get("SUPABASE_URL")||"", key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||""; if(!url||!key)throw new Error("Supabase service configuration is missing.");
    const db=createClient(url,key,{auth:{persistSession:false}}), now=londonParts();
    if(["send_confirmation","test_reminder"].includes(body.action)){
      const admin=await adminUser(request,db); if(!admin)return respond({error:"Not authorised"},403);
      const booking=await loadBooking(db,String(body.bookingId||"")); if(booking.status!=="confirmed")return respond({error:"Only confirmed bookings can be emailed."},409);
      const to=await recipients(db,booking); if(!to.length)return respond({error:"No valid client email address is recorded."},400);
      if(body.action==="test_reminder"){const item=occurrences(booking).find((entry)=>entry.date>=now.date)||occurrences(booking)[0],message=reminderMessage(booking,item);await send(admin.email||"",`[TEST] ${message.subject}`,message.text);return respond({sent:1,recipients:[admin.email],test:true});}
      return respond({sent:await sendConfirmation(db,booking,to),recipients:to,remindersEnabled:true});
    }
    if(body.scheduled===true&&!(now.hour===8&&now.minute<=10))return respond({skipped:true,reason:"Outside the 08:00 Europe/London delivery window"});
    const targetDate=addDays(now.date,1), result=await db.from("booking_requests").select(bookingFields).eq("status","confirmed").eq("email_notifications_enabled",true).lte("preferred_date",targetDate); if(result.error)throw result.error;
    const due=(result.data as Booking[]||[]).flatMap((booking)=>occurrences(booking).filter((item)=>item.date===targetDate).map((occurrence)=>({booking,occurrence}))); let sent=0,alreadySent=0,failed=0;
    for(const {booking,occurrence} of due)for(const email of await recipients(db,booking)){
      const fields={booking_id:booking.id,occurrence_date:occurrence.date,occurrence_time:occurrence.time,recipient_email:email}, oldResult=await db.from("appointment_reminder_deliveries").select("id,status,attempt_count,updated_at").match(fields).maybeSingle(), old=oldResult.data;
      const fresh=old?.status==="processing"&&Date.now()-new Date(old.updated_at).getTime()<900000; if(old?.status==="sent"||fresh){alreadySent++;continue;}
      const delivery={...fields,status:"processing",attempt_count:Number(old?.attempt_count||0)+1,last_error:null,updated_at:new Date().toISOString()}, saved=old?await db.from("appointment_reminder_deliveries").update(delivery).eq("id",old.id).select("id").single():await db.from("appointment_reminder_deliveries").insert(delivery).select("id").single(); if(saved.error||!saved.data){failed++;continue;}
      try{const message=reminderMessage(booking,occurrence),messageId=await send(email,message.subject,message.text);await db.from("appointment_reminder_deliveries").update({status:"sent",provider_message_id:messageId||null,sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",saved.data.id);sent++;}
      catch(error){const detail=error instanceof Error?error.message:String(error);await db.from("appointment_reminder_deliveries").update({status:"failed",last_error:detail.slice(0,1000),updated_at:new Date().toISOString()}).eq("id",saved.data.id);failed++;}
    }
    return respond({targetDate,due:due.length,sent,alreadySent,failed});
  }catch(error){console.error(error);return respond({error:error instanceof Error?error.message:"Emails could not be processed."},500);}
});
