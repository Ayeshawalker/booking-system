import { createClient } from "npm:@supabase/supabase-js@2";

const timeZone = "Europe/London";
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://ayeshawalker.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
type Booking = { id:string; client_id:string|null; status:string; email_notifications_enabled:boolean; booking_type:string; block_session_count:number|null; block_date_pattern:string|null; block_frequency:string|null; exact_block_dates:unknown; session_type:string; session_format:string; preferred_date:string; preferred_time:string; first_name:string|null; second_first_name:string|null; email:string; zoom_join_url:string|null };
type Occurrence = { date:string; time:string; format:string };
type Database = ReturnType<typeof createClient>;
const bookingFields = "id,client_id,status,email_notifications_enabled,booking_type,block_session_count,block_date_pattern,block_frequency,exact_block_dates,session_type,session_format,preferred_date,preferred_time,first_name,second_first_name,email,zoom_join_url";

function respond(body:unknown, status=200) { return new Response(JSON.stringify(body), { status, headers:{...corsHeaders,"Content-Type":"application/json"} }); }
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
const zoneLabels:Record<string,string>={"Europe/Paris":"France time","Europe/Dublin":"Ireland/Portugal time","America/New_York":"Eastern time","America/Chicago":"Central time","America/Denver":"Mountain time","America/Los_Angeles":"Pacific time","Asia/Dubai":"Dubai time","Asia/Kolkata":"India time","Australia/Sydney":"Sydney time","Pacific/Auckland":"New Zealand time"};
function occurrenceInstant(date:string,appointmentTime:string){const [year,month,day]=date.split("-").map(Number),[hour,minute]=appointmentTime.split(":").map(Number),estimate=new Date(Date.UTC(year,month-1,day,hour,minute));const parts=new Intl.DateTimeFormat("en-GB",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(estimate),part=(type:string)=>Number(parts.find((item)=>item.type===type)?.value||0),londonAsUtc=Date.UTC(part("year"),part("month")-1,part("day"),part("hour"),part("minute"));return new Date(estimate.getTime()-(londonAsUtc-estimate.getTime()));}
function appointmentWhen(date:string,appointmentTime:string,clientZone:string){const uk=`${displayDate(date)} at ${appointmentTime}`;if(!clientZone||clientZone===timeZone)return uk;const instant=occurrenceInstant(date,appointmentTime),localDate=new Intl.DateTimeFormat("en-GB",{timeZone:clientZone,weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(instant),localTime=new Intl.DateTimeFormat("en-GB",{timeZone:clientZone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(instant);return `${uk} UK time (${localDate} at ${localTime} ${zoneLabels[clientZone]||"local time"})`;}
function details(format:string, zoomLink="") {
  if (format === "In person") return "in person at Cherry Tree Therapy Centre, Henley-on-Thames";
  if (format === "Telephone call") return "by telephone";
  if (["Online","Zoom call"].includes(format)) return zoomLink ? `by Zoom. Your joining link is: ${zoomLink}` : "online, using your agreed joining details";
  return String(format||"using the agreed format").toLowerCase();
}
function greeting(booking:Booking) { const names=[booking.first_name,booking.second_first_name].map((name)=>String(name||"").trim()).filter(Boolean); return names.length?`Hi ${names.join(" and ")},`:"Hello,"; }
function escapeHtml(value:unknown) { return String(value||"").replace(/[&<>"']/g,(character)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[character]||character)); }
function emailShell(preview:string, greetingText:string, content:string) { return `<!doctype html><html><body style="margin:0;background:#fff8ee;font-family:Trebuchet MS,Verdana,Arial,sans-serif;color:#4d1430"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preview)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff8ee"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #ffc9ae;border-radius:18px;overflow:hidden"><tr><td style="height:10px;background:linear-gradient(90deg,#f9a22c,#e61d8d)"></td></tr><tr><td align="center" style="padding:28px 28px 16px"><img src="https://ayeshawalker.github.io/booking-system/assets/aj-logo-medium-preview.png" width="230" alt="Ayesha Jane" style="display:block;width:230px;max-width:80%;height:auto"></td></tr><tr><td style="padding:8px 38px 36px;font-size:16px;line-height:1.65"><p style="margin:0 0 20px;font-size:18px;font-weight:700;color:#b71368">${escapeHtml(greetingText)}</p>${content}<p style="margin:24px 0 0">Warm wishes,<br><strong style="color:#b71368">Ayesha</strong></p></td></tr><tr><td style="padding:14px 24px;background:#fff0d2;text-align:center;color:#7d5410;font-size:12px">Ayesha Jane Therapy Counselling Coaching</td></tr></table></td></tr></table></body></html>`; }
function formatLabel(format:string) { if(["Online","Zoom call"].includes(format))return "via Zoom"; if(format==="In person")return "in person at Cherry Tree Therapy Centre, Henley-on-Thames"; if(format==="Telephone call")return "by telephone"; return String(format||"using the agreed format").toLowerCase(); }
function zoomButton(link:string) { return `<p style="margin:16px 0 22px"><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#e61d8d;color:#ffffff;text-decoration:none;font-weight:700">Join your Zoom session</a></p>`; }
function reminderMessage(booking:Booking, occurrence:Occurrence, clientZone=timeZone) { const line=`Just a courtesy reminder that your session with me is tomorrow, ${appointmentWhen(occurrence.date,occurrence.time,clientZone)}, ${formatLabel(occurrence.format)}.`; const zoom=booking.zoom_join_url&&["Online","Zoom call"].includes(occurrence.format)?booking.zoom_join_url:""; const text=[greeting(booking),"",line,zoom?`Your joining link is: ${zoom}`:"","If you need to get in touch about your appointment, simply reply to this email.","","I look forward to seeing you tomorrow.","","Warm wishes,","Ayesha"].filter(Boolean).join("\n"); const html=emailShell(line,greeting(booking),`<p style="margin:0 0 16px">${escapeHtml(line)}</p>${zoom?`<p style="margin:0">Your joining link is:</p>${zoomButton(zoom)}`:""}<p style="margin:0 0 16px">If you need to get in touch about your appointment, simply reply to this email.</p><p style="margin:0">I look forward to seeing you tomorrow.</p>`); return {subject:`Reminder: your session with Ayesha tomorrow at ${occurrence.time} UK time`,text,html}; }
function confirmationMessage(booking:Booking,clientZone=timeZone) {
  const items=occurrences(booking), intro=items.length>1?"Just confirming your sessions with me:":"Just confirming your session with me:";
  const lines=items.map((item)=>`• ${appointmentWhen(item.date,item.time,clientZone)}, ${formatLabel(item.format)}.${booking.zoom_join_url&&["Online","Zoom call"].includes(item.format)?` Your joining link is: ${booking.zoom_join_url}`:""}`);
  const text=[greeting(booking),"",intro,"",...lines,"","If you need to get in touch or rearrange your appointment, simply reply to this email. If you do need to make a change, if possible please give me at least 48 hours’ notice to avoid a cancellation charge.","","I look forward to seeing you then.","","Warm wishes,","Ayesha"].join("\n");
  const itemHtml=items.map((item)=>{const zoom=booking.zoom_join_url&&["Online","Zoom call"].includes(item.format)?booking.zoom_join_url:"";return `<div style="margin:12px 0;padding:16px;border-left:5px solid #f9a22c;border-radius:10px;background:#fff8ee"><strong style="color:#4d1430">${escapeHtml(appointmentWhen(item.date,item.time,clientZone))}, ${escapeHtml(formatLabel(item.format))}.</strong>${zoom?`<p style="margin:10px 0 0">Your joining link is:</p>${zoomButton(zoom)}`:""}</div>`;}).join("");
  const html=emailShell(intro,greeting(booking),`<p style="margin:0 0 14px">${escapeHtml(intro)}</p>${itemHtml}<p style="margin:22px 0 16px">If you need to get in touch or rearrange your appointment, simply reply to this email. If you do need to make a change, if possible please give me at least 48 hours’ notice to avoid a cancellation charge.</p><p style="margin:0">I look forward to seeing you then.</p>`);
  return {subject:items.length>1?"Your sessions with Ayesha are confirmed":"Your session with Ayesha is confirmed",text,html};
}
function cancellationMessage(booking:Booking,clientZone=timeZone) {
  const item=occurrences(booking)[0], line=`Just confirming that your session on ${appointmentWhen(item.date,item.time,clientZone)} has been cancelled.`;
  const text=[greeting(booking),"",line,"","If you haven’t already arranged another time and would like to, simply reply to this email.","","Warm wishes,","Ayesha"].join("\n");
  const html=emailShell(line,greeting(booking),`<p style="margin:0 0 16px">${escapeHtml(line)}</p><p style="margin:0">If you haven’t already arranged another time and would like to, simply reply to this email.</p>`);
  return {subject:"Your session with Ayesha has been cancelled",text,html};
}
function rescheduleMessage(booking:Booking,clientZone=timeZone) {
  const item=occurrences(booking)[0], line=`Just confirming your rearranged session with me:`, detail=`${appointmentWhen(item.date,item.time,clientZone)}, ${formatLabel(item.format)}.`;
  const zoom=booking.zoom_join_url&&["Online","Zoom call"].includes(item.format)?booking.zoom_join_url:"";
  const text=[greeting(booking),"",line,`• ${detail}`,zoom?`Your new joining link is: ${zoom}`:"","If you need to get in touch about your appointment, simply reply to this email.","","I look forward to seeing you then.","","Warm wishes,","Ayesha"].filter(Boolean).join("\n");
  const html=emailShell(line,greeting(booking),`<p style="margin:0 0 14px">${escapeHtml(line)}</p><div style="margin:12px 0;padding:16px;border-left:5px solid #f9a22c;border-radius:10px;background:#fff8ee"><strong>${escapeHtml(detail)}</strong>${zoom?`<p style="margin:10px 0 0">Your new joining link is:</p>${zoomButton(zoom)}`:""}</div><p style="margin:22px 0 16px">If you need to get in touch about your appointment, simply reply to this email.</p><p style="margin:0">I look forward to seeing you then.</p>`);
  return {subject:"Your session with Ayesha has been rearranged",text,html};
}
async function send(to:string, subject:string, text:string, html="") {
  const apiKey=Deno.env.get("RESEND_API_KEY")||""; if(!apiKey) throw new Error("RESEND_API_KEY is not configured.");
  const result=await fetch("https://api.resend.com/emails",{method:"POST",signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({from:Deno.env.get("APPOINTMENT_REMINDER_FROM")||"Ayesha Jane <info@ayeshajane.com>",reply_to:Deno.env.get("APPOINTMENT_REMINDER_REPLY_TO")||"info@ayeshajane.com",to:[to],subject,text,...(html?{html}:{})})});
  const body=await result.json().catch(()=>({})); if(!result.ok) throw new Error(`Resend returned ${result.status}: ${JSON.stringify(body).slice(0,300)}`); return String(body.id||"");
}
async function loadBooking(db:Database,id:string) { const {data,error}=await db.from("booking_requests").select(bookingFields).eq("id",id).maybeSingle(); if(error||!data) throw new Error("Booking not found."); return data as Booking; }
async function recipients(db:Database, booking:Booking) {
  let emails:string[]=[];
  if(booking.client_id){const {data}=await db.from("clients").select("email,second_email").eq("id",booking.client_id).maybeSingle(); emails=[data?.email,data?.second_email].filter(Boolean) as string[];}
  if(!emails.length) emails=[booking.email];
  return [...new Set(emails.map((email)=>String(email||"").trim().toLowerCase()))].filter((email)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}
async function bookingClientTimeZone(db:Database,booking:Booking){if(!booking.client_id)return timeZone;const {data}=await db.from("clients").select("client_time_zone").eq("id",booking.client_id).maybeSingle();return String(data?.client_time_zone||timeZone);}
async function adminUser(request:Request,db:Database,bodyToken="") { const headerToken=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||""; const token=String(bodyToken||headerToken); const {data}=await db.auth.getUser(token); if(!data.user)return null; const {data:member}=await db.from("admin_users").select("user_id").eq("user_id",data.user.id).maybeSingle(); return member?data.user:null; }
async function sendConfirmation(db:Database,booking:Booking,to:string[],clientZone=timeZone) {
  const message=confirmationMessage(booking,clientZone); let sent=0;
  for(const email of to){
    const {data:old}=await db.from("booking_confirmation_deliveries").select("id,status,attempt_count").eq("booking_id",booking.id).eq("recipient_email",email).maybeSingle(); if(old?.status==="sent")continue;
    const delivery={booking_id:booking.id,recipient_email:email,status:"processing",attempt_count:Number(old?.attempt_count||0)+1,last_error:null,updated_at:new Date().toISOString()};
    const saved=old?await db.from("booking_confirmation_deliveries").update(delivery).eq("id",old.id).select("id").single():await db.from("booking_confirmation_deliveries").insert(delivery).select("id").single(); if(saved.error||!saved.data)throw saved.error||new Error("Could not reserve email delivery.");
    try{const messageId=await send(email,message.subject,message.text,message.html);await db.from("booking_confirmation_deliveries").update({status:"sent",provider_message_id:messageId||null,sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",saved.data.id);sent++;}
    catch(error){const detail=error instanceof Error?error.message:String(error);await db.from("booking_confirmation_deliveries").update({status:"failed",last_error:detail.slice(0,1000),updated_at:new Date().toISOString()}).eq("id",saved.data.id);throw error;}
  }
  await db.from("booking_requests").update({email_notifications_enabled:true}).eq("id",booking.id); return sent;
}
async function sendChangeNotice(booking:Booking,to:string[],kind:"cancel"|"reschedule",clientZone=timeZone) {
  const message=kind==="cancel"?cancellationMessage(booking,clientZone):rescheduleMessage(booking,clientZone);
  for(const email of to) await send(email,message.subject,message.text,message.html);
  return to.length;
}

Deno.serve(async(request)=>{
  if(request.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(request.method!=="POST")return respond({error:"Method not allowed"},405);
  try{
    const body=await request.json().catch(()=>({})), url=Deno.env.get("SUPABASE_URL")||"", key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||""; if(!url||!key)throw new Error("Supabase service configuration is missing.");
    const db=createClient(url,key,{auth:{persistSession:false}}), now=londonParts();
    if(body.action==="process_job"){
      const {data:job}=await db.from("appointment_email_jobs").select("*").eq("id",String(body.jobId||"")).maybeSingle();
      if(!job)return respond({error:"Email job not found."},404);
      if(job.status==="completed")return respond(job.result||{completed:true});
      await db.from("appointment_email_jobs").update({status:"processing",updated_at:new Date().toISOString()}).eq("id",job.id);
      try{
        const booking=await loadBooking(db,job.booking_id);
        if(job.action==="send_cancellation"?booking.status!=="closed":booking.status!=="confirmed")throw new Error("The booking status does not match this email.");
        const to=await recipients(db,booking),clientZone=await bookingClientTimeZone(db,booking); if(!to.length)throw new Error("No valid client email address is recorded.");
        let result:Record<string,unknown>;
        if(job.action==="test_reminder"){
          const item=occurrences(booking).find((entry)=>entry.date>=now.date)||occurrences(booking)[0],message=reminderMessage(booking,item,clientZone);
          if(!job.requested_email)throw new Error("Your administrator email address is missing.");
          await send(job.requested_email,`[TEST] ${message.subject}`,message.text,message.html); result={sent:1,recipients:[job.requested_email],test:true};
        }else if(job.action==="send_cancellation") result={sent:await sendChangeNotice(booking,to,"cancel",clientZone),recipients:to};
        else if(job.action==="send_reschedule") result={sent:await sendChangeNotice(booking,to,"reschedule",clientZone),recipients:to};
        else result={sent:await sendConfirmation(db,booking,to,clientZone),recipients:to,remindersEnabled:true};
        await db.from("appointment_email_jobs").update({status:"completed",result,updated_at:new Date().toISOString()}).eq("id",job.id);
        return respond(result);
      }catch(error){const detail=error instanceof Error?error.message:String(error);await db.from("appointment_email_jobs").update({status:"failed",last_error:detail.slice(0,1000),updated_at:new Date().toISOString()}).eq("id",job.id);return respond({error:detail},500);}
    }
    if(["send_confirmation","test_reminder","send_cancellation","send_reschedule"].includes(body.action)){
      const admin=await adminUser(request,db,body.adminAccessToken); if(!admin)return respond({error:"Not authorised"},403);
      const booking=await loadBooking(db,String(body.bookingId||""));
      if(body.action==="send_cancellation"?booking.status!=="closed":booking.status!=="confirmed")return respond({error:"The booking status does not match this email."},409);
      const to=await recipients(db,booking),clientZone=await bookingClientTimeZone(db,booking); if(!to.length)return respond({error:"No valid client email address is recorded."},400);
      if(body.action==="test_reminder"){const item=occurrences(booking).find((entry)=>entry.date>=now.date)||occurrences(booking)[0],message=reminderMessage(booking,item,clientZone);await send(admin.email||"",`[TEST] ${message.subject}`,message.text,message.html);return respond({sent:1,recipients:[admin.email],test:true});}
      if(body.action==="send_cancellation")return respond({sent:await sendChangeNotice(booking,to,"cancel",clientZone),recipients:to});
      if(body.action==="send_reschedule")return respond({sent:await sendChangeNotice(booking,to,"reschedule",clientZone),recipients:to});
      return respond({sent:await sendConfirmation(db,booking,to,clientZone),recipients:to,remindersEnabled:true});
    }
    if(body.scheduled===true&&!(now.hour===8&&now.minute<=10))return respond({skipped:true,reason:"Outside the 08:00 Europe/London delivery window"});
    const targetDate=addDays(now.date,1), result=await db.from("booking_requests").select(bookingFields).eq("status","confirmed").eq("email_notifications_enabled",true).lte("preferred_date",targetDate); if(result.error)throw result.error;
    const due=(result.data as Booking[]||[]).flatMap((booking)=>occurrences(booking).filter((item)=>item.date===targetDate).map((occurrence)=>({booking,occurrence}))); let sent=0,alreadySent=0,failed=0;
    for(const {booking,occurrence} of due){const clientZone=await bookingClientTimeZone(db,booking);for(const email of await recipients(db,booking)){
      const fields={booking_id:booking.id,occurrence_date:occurrence.date,occurrence_time:occurrence.time,recipient_email:email}, oldResult=await db.from("appointment_reminder_deliveries").select("id,status,attempt_count,updated_at").match(fields).maybeSingle(), old=oldResult.data;
      const fresh=old?.status==="processing"&&Date.now()-new Date(old.updated_at).getTime()<900000; if(old?.status==="sent"||fresh){alreadySent++;continue;}
      const delivery={...fields,status:"processing",attempt_count:Number(old?.attempt_count||0)+1,last_error:null,updated_at:new Date().toISOString()}, saved=old?await db.from("appointment_reminder_deliveries").update(delivery).eq("id",old.id).select("id").single():await db.from("appointment_reminder_deliveries").insert(delivery).select("id").single(); if(saved.error||!saved.data){failed++;continue;}
      try{const message=reminderMessage(booking,occurrence,clientZone),messageId=await send(email,message.subject,message.text,message.html);await db.from("appointment_reminder_deliveries").update({status:"sent",provider_message_id:messageId||null,sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",saved.data.id);sent++;}
      catch(error){const detail=error instanceof Error?error.message:String(error);await db.from("appointment_reminder_deliveries").update({status:"failed",last_error:detail.slice(0,1000),updated_at:new Date().toISOString()}).eq("id",saved.data.id);failed++;}
    }}
    return respond({targetDate,due:due.length,sent,alreadySent,failed});
  }catch(error){console.error(error);return respond({error:error instanceof Error?error.message:"Emails could not be processed."},500);}
});
