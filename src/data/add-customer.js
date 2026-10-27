import {fail} from './domain.js';
import {CUSTOMER_CLASSIFICATIONS} from './customer-classifications.js';

export function prepareManualCustomer(input,finance){
 const code=String(input?.code??``).trim();
 const name=String(input?.name??``).trim();
 const teamId=String(input?.teamId??``).trim();
 const classification=String(input?.classification??``).trim();
 const kind=String(input?.kind??`طبيب`).trim()||`طبيب`;
 const specialty=String(input?.specialty??``).trim();
 const area=String(input?.area??``).trim();
 fail(code.length>0&&code.length<=100&&!code.includes(`/`),`كود العميل إلزامي ويجب ألا يتجاوز 100 حرف أو يحتوي على /`);
 fail(name.length>0&&name.length<=200,`اسم العميل إلزامي ويجب ألا يتجاوز 200 حرف`);
 fail([kind,specialty,area].every(value=>value.length<=200),`بيانات العميل تتجاوز الحد المسموح (200 حرف)`);
 fail(finance?.teams?.[teamId],`اختر فريقا صحيحا`);
 fail(CUSTOMER_CLASSIFICATIONS.includes(classification),`اختر تصنيفا معتمدا للعميل`);
 fail(!(finance.pausedTeams||[]).length&&!Object.keys(finance.uploads||{}).length,`أكمل رفع قوائم العملاء قبل إضافة عميل جديد`);
 return {code,name,kind,specialty,area,teamId,classification};
}
