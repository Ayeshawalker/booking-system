// Run with JavaScriptCore: jsc tests/cancel-recurring-series.js -- [calendar.js]
const source = readFile((typeof arguments !== 'undefined' && arguments[0]) || 'app/calendar.js');
new Function(source);
function assert(value, message) { if (!value) throw new Error(message); }
const a = source.indexOf('  function remainingSeriesBookings(');
const b = source.indexOf('  controls.cancelBooking.addEventListener', a);
if (a < 0 || b < 0) throw new Error('Series cancellation code missing');
let click, confirmed = true, failOn = '', closed = false;
const selected = {id:'selected', recurring_series_id:'series', preferred_date:'2099-01-01',preferred_time:'10:00'};
const row = (id, date, status='confirmed', series='series', time='10:00') => ({id,preferred_date:date,preferred_time:time,status,recurring_series_id:series});
const rows = [row('later','2099-01-08'),row('selected','2099-01-01'),row('earlier','2098-12-25'),row('closed','2099-01-15','closed'),row('other','2099-01-22','confirmed','other')];
const calls = [];
const controls = {cancelSeries:{disabled:false,addEventListener:(_,fn)=>click=fn},cancelBooking:{disabled:false},bookingDetailsMessage:{textContent:''},message:{textContent:''},dialog:{close:()=>closed=true}};
const state = {selectedEvent:{bookingRequestId:'selected',title:'Fixture client'}};
const window = {confirm:()=>confirmed,BOOKING_CONFIG:{}};
async function loadEvents() {}
const supabaseClient = {
 from(table) {
  assert(table === 'booking_requests','Only booking records queried');
  return {select(){return this;},eq(field,value){
   assert((field==='id'&&value==='selected')||(field==='recurring_series_id'&&value==='series'),'Correct series scope');return this;
  },async single(){return {data:selected,error:null};},async gte(){return {data:rows,error:null};}};
 },
 functions:{async invoke(name,args){
  assert(name==='calendar-reschedule-booking','Use established cancellation endpoint, never email endpoint');
  assert(args.body.action==='cancel','Only cancellation requested');
  calls.push(args.body.bookingId);
  return args.body.bookingId===failOn?{error:new Error('Fixture failure')}:{data:{status:'cancelled'}};
 }},
};
eval(source.slice(a,b));
const now = new Date('2099-01-01T09:00:00Z');
assert(remainingSeriesBookings(rows,selected,now).map(r=>r.id).join(',')==='selected,later','Only active sessions from selected date in same series');
assert(remainingSeriesBookings(rows,selected,new Date('2099-01-01T11:00:00Z')).map(r=>r.id).join(',')==='later','Earlier time today protected');
const summer=[row('past','2099-07-01','confirmed','series','10:00'),row('future','2099-07-01','confirmed','series','11:00')];
assert(remainingSeriesBookings(summer,{...selected,preferred_date:'2099-07-01',preferred_time:'00:00'},new Date('2099-07-01T09:30:00Z')).map(r=>r.id).join(',')==='future','British Summer Time respected');
(async()=>{
 confirmed=false;await click();assert(calls.length===0,'Declining confirmation has no effect');
 confirmed=true;await click();assert(calls.join(',')==='selected,later','Both remaining bookings cancelled in order');
 assert(closed,'Dialog closes on success');assert(controls.message.textContent.includes('No client emails'),'No-email result visible');
 calls.length=0;closed=false;failOn='selected';await click();
 assert(calls.join(',')==='selected','Stop after failure rather than continuing');
 assert(!closed,'Failure remains visible');assert(controls.message.textContent.includes('stopped after 0'),'Partial cancellation reported honestly');
 assert(!controls.cancelSeries.disabled&&!controls.cancelBooking.disabled,'Controls restored after failure');
 print('Recurring series cancellation regression checks passed');
})().catch(e=>{print('FAIL: '+e.message);quit(1);});
