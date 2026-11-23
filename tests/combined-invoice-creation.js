// Run with JavaScriptCore: jsc tests/combined-invoice-creation.js -- [payments.js]
const source = readFile((typeof arguments !== 'undefined' && arguments[0]) || 'app/payments.js');
new Function(source);
const start = source.indexOf('  async function createInvoiceFromSelectedPayments()');
const end = source.indexOf('\n  function openHistory(', start);
if (start < 0 || end < 0) throw new Error('Combined invoice action missing');
function assert(value, message) { if (!value) throw new Error(message); }
const historyClient = {id:'couple',record_type:'Couple',first_name:'Partner A',second_first_name:'Partner B'};
const selected = [
  {id:'payment-1',session_date:'2026-11-01',fee_due:120,amount_received:0,source_reference:'invoice:earlier-1',session_format:'Online'},
  {id:'payment-2',session_date:'2026-11-08',fee_due:120,amount_received:0,source_reference:'invoice:earlier-2',session_format:'Online'},
];
const selectedInvoicePaymentIds = new Set(selected.map(p => p.id));
const controls = {createHistoryInvoice:{disabled:false},message:{textContent:''}};
const window = {confirm:() => true,alert:message => {throw new Error(message);},location:{href:''}};
const console = {error:() => {}};
const calls = [];
function paymentsForClient() { return selected; }
function clientName() { return 'Partner A and Partner B'; }
function currency(n) { return String(n); }
function createUuid() { return 'booking'; }
function invoiceReferenceForDate() { return '01NOV26'; }
function rememberInvoiceReturnPosition() {}
const supabaseClient = {
  from(table) {
    if (table === 'manual_payments') throw new Error('Must preserve each selected payment reference');
    return {
      async insert() { calls.push('booking'); return {error:null}; },
      update() { return {async eq() { return {error:null}; }}; },
    };
  },
  async rpc(name, args) {
    calls.push(name);
    if (name === 'set_invoice_replacements') {
      assert(args.p_replaced_invoice_ids.join(',') === 'earlier-1,earlier-2', 'Both original invoices linked');
      return {data:2,error:null};
    }
    if (name === 'create_combined_invoice') {
      assert(args.p_payment_ids.join(',') === 'payment-1,payment-2', 'Both payments selected');
    }
    return {data:'combined',error:null};
  },
};
eval(source.slice(start, end));
createInvoiceFromSelectedPayments().then(() => {
  assert(window.location.href === 'invoice.html?id=combined', 'Combined invoice opens');
  assert(selected[0].source_reference === 'invoice:earlier-1', 'First reference preserved');
  assert(selected[1].source_reference === 'invoice:earlier-2', 'Second reference preserved');
  assert(calls.includes('set_invoice_replacements') || calls.includes('create_combined_invoice'), 'Replacement links created');
  print('Combined invoice regression passed');
}).catch(error => { print('FAIL: '+error.message); quit(1); });
