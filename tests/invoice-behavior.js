// Run from the repository root with JavaScriptCore's jsc.
function extractFunction(source, name) {
  const start = source.indexOf("  function " + name + "(");
  const end = source.indexOf("\n  }", start) + 4;
  if (start < 0 || end < 4) throw new Error("Missing function " + name);
  return source.slice(start, end);
}
for (const filename of ["app/payments.js", "app/invoice.js"]) {
  new Function(readFile(filename));
}
function assert(value, message) { if (!value) throw new Error(message); }
const payments = [];
eval(extractFunction(readFile("app/payments.js"), "invoiceOutstanding"));
assert(invoiceOutstanding({invoice_kind:'Company',status:'Sent',amount:750}) === 750, 'Workshop fee outstanding');
assert(invoiceOutstanding({invoice_kind:'Company',status:'Paid',amount:750}) === 0, 'Paid workshop balance');
function sourceBookingForInvoice() { return null; }
eval(extractFunction(readFile("app/payments.js"), "invoiceSourceIssue"));
assert(invoiceSourceIssue({invoice_kind:'Company'}) === '', 'Company needs no booking');
assert(invoiceSourceIssue({invoice_kind:'Session'}) !== '', 'Session still needs booking');
eval(extractFunction(readFile("app/invoice.js"), "invoiceSessionDates"));
eval(extractFunction(readFile("app/invoice.js"), "cleanInvoiceDescription"));
eval(extractFunction(readFile("app/invoice.js"), "invoiceLineItems"));
const items = [{date:'2026-11-01', type:'Joint session', format:'Online', fee:150},{date:'2026-11-08',type:'Joint session',format:'Online',fee:150}];
const raw = JSON.stringify(items).replace(/%/g,'%25').replace(/\[/g,'%5B').replace(/\]/g,'%5D');
const combined = {description:'Sessions [[DATES:2026-11-01,2026-11-08]] [[ITEMS:'+raw+']]',session_date:'2026-11-01',session_count:2,amount:300};
assert(invoiceLineItems(combined).length === 2, 'Two combined lines');
assert(invoiceLineItems(combined).every(i => i.fee === 150 && i.type === 'Joint session'), 'Joint fees preserved');
assert(invoiceLineItems({description:'Teaching workshop', session_date:'2026-11-23',session_count:1,amount:750})[0].fee === 750, 'Fixed workshop fee');
print('Invoice behavior checks passed');
