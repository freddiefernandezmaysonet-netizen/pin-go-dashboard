import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000';
const prices: Record<string, Record<number, number>> = { essential:{12:54.99,24:44.99},pro:{12:74.99,24:64.99},elite:{12:84.99,24:74.99} };
export default function SignupPage() {
  const [params] = useState(()=>new URLSearchParams(window.location.search));
  const es = params.get('lang') !== 'en';
  const t = (spanish:string,english:string)=>es?spanish:english;
  const haas = params.get('plan') === 'haas';
  const model = params.get('lock') ?? '';
  const term = Number(params.get('termMonths') ?? 24);
  const validSelection = !haas || (Object.hasOwn(prices,model) && [12,24].includes(term) && !['one','two','1','2'].includes(params.get('smartDevices')??''));
  const [fields,setFields]=useState({organizationName:'',fullName:'',email:'',phone:'',password:''});
  const [locks,setLocks]=useState(1),[submitting,setSubmitting]=useState(false),[error,setError]=useState('');
  const [billingInterval,setBillingInterval]=useState<'monthly'|'yearly'>(params.get('billingInterval')==='yearly'?'yearly':'monthly');
  const yearly=!haas && billingInterval==='yearly';
  const [mobile,setMobile]=useState(false);const busy=useRef(false);
  useEffect(()=>{const check=()=>setMobile(innerWidth<900);check();window.addEventListener('resize',check);return()=>window.removeEventListener('resize',check);},[]);
  const amount = haas && validSelection ? prices[model][term] : yearly ? 399.90 : 39.99;
  async function submit(e:React.FormEvent){
    e.preventDefault();if(busy.current || !validSelection)return;busy.current=true;setSubmitting(true);setError('');
    try {
      const response=await fetch(`${API_BASE}/api/public/signup-checkout`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        ...fields,email:fields.email.trim().toLowerCase(),organizationName:fields.organizationName.trim(),fullName:fields.fullName.trim(),phone:fields.phone.trim(),
        lang:es?'es':'en',plan:haas?'haas':'platform',locks:haas?1:locks,billingInterval:haas?'monthly':billingInterval,contractOption:haas?(term===12?'contract_12_lock':'contract_24_lock'):'standard',
        haasSelection:haas?{plan:'haas',lock:model,termMonths:term,smartDevices:'none'}:null,
      })});
      const data=await response.json();
      if(!response.ok || !data.url){
        if(data.error==='Account already exists')throw new Error(t('Ya existe una cuenta con este correo. Inicia sesión o utiliza otro correo.','An account already exists with this email. Sign in or use another email.'));
        if(data.error==='WEAK_PASSWORD')throw new Error(t('La contraseña no cumple los requisitos indicados. Evita incluir tu correo, nombre u organización.','The password does not meet the listed requirements. Avoid your email, name or organization.'));
        throw new Error(t('No se pudo iniciar el pago. Revisa tus datos e inténtalo nuevamente.','Could not start checkout. Check your details and try again.'));
      }
      const checkout=new URL(data.url);if(checkout.protocol!=='https:' || checkout.hostname!=='checkout.stripe.com')throw new Error(t('No se pudo abrir el pago seguro.','Could not open secure checkout.'));
      window.location.assign(checkout.href);
    }catch(e){setError(e instanceof Error?e.message:t('No se pudo iniciar el pago.','Could not start checkout.'));}
    finally{busy.current=false;setSubmitting(false);}
  }
  const input:React.CSSProperties={width:'100%',boxSizing:'border-box',height:44,border:'1px solid #d1d5db',borderRadius:10,padding:'10px 12px',fontFamily:'inherit',fontSize:16};
  return <main style={{minHeight:'100vh',background:'linear-gradient(180deg,#f8fafc,#eef2ff)',display:'grid',placeItems:'center',padding:mobile?16:24}}>
    <div style={{width:'100%',maxWidth:1080,display:'grid',gridTemplateColumns:mobile?'1fr':'1.05fr .95fr',background:'#fff',border:'1px solid #e5e7eb',borderRadius:24,boxShadow:'0 24px 60px rgba(15,23,42,.10)',overflow:'hidden'}}>
      <section style={{background:'linear-gradient(180deg,#0f172a,#1e293b)',color:'#fff',padding:mobile?24:36}}>
        <Link to={`/home?lang=${es?'es':'en'}`} style={{display:'flex',alignItems:'center',gap:12,color:'#fff',textDecoration:'none'}}><img src="/pin-go-logo.png" alt="Pin&Go" width={48} height={48}/><strong style={{fontSize:24}}>Pin&Go</strong></Link>
        <h1 style={{marginTop:40,fontSize:mobile?32:42,lineHeight:1.1}}>{t('Pin&Go administra. Tú ganas libertad.','Pin&Go manages. You gain freedom.')}</h1>
        <p style={{color:'#cbd5e1',fontSize:17,lineHeight:1.7}}>{t('Crea tu organización y continúa al pago seguro para activar tu cuenta.','Create your organization and continue to secure checkout to activate your account.')}</p>
        <ul style={{paddingLeft:20,color:'#dbeafe',lineHeight:2}}>{[t('Reservas, calendario y pagos conectados','Connected reservations, calendar and payments'),t('Acceso automático por reservación','Automatic access by reservation'),t('Coordinación y seguimiento de limpieza','Cleaning coordination and tracking')].map(text=><li key={text}>{text}</li>)}</ul>
        <div style={{marginTop:28,padding:20,border:'1px solid #475569',borderRadius:16}}>
          <h2 style={{fontSize:20,marginTop:0}}>{haas?`${model.charAt(0).toUpperCase()+model.slice(1)} Lock`:t('Membresía Pin&Go','Pin&Go membership')}</h2>
          {validSelection && <><strong style={{fontSize:30}}>${amount.toFixed(2)}</strong><span>{yearly?t(' / año + impuestos',' / year + taxes'):t(' / mes + impuestos',' / month + taxes')}</span></>}
          <p>{haas?t(`Contrato de ${term} meses · una cerradura.`,`A ${term}-month agreement · one lock.`):yearly?t('Por cerradura · pago anual.','Per lock · annual payment.'):t('Por cerradura · pago mensual.','Per lock · monthly payment.')}</p>
          {haas && <p>{t('Incluye Pin&Go y el alquiler del hardware. Coordinaremos contigo la instalación.','Includes Pin&Go and hardware rental. We will coordinate installation with you.')}</p>}
          <p style={{fontSize:13,color:'#cbd5e1'}}>{t('Pin AI opcional: $1.00 por reservación. Verificación de identidad con selfie: $2.50 por verificación utilizada.','Optional Pin AI: $1.00 per reservation. Identity Check with selfie: $2.50 per verification used.')}</p>
        </div>
      </section>
      <section style={{padding:mobile?22:32}}>
        <h2 style={{fontSize:30,marginTop:0}}>{t('Crear cuenta','Create your account')}</h2>
        {!validSelection && <p role="alert">{t('Selecciona una cerradura y contrato válidos desde la landing.','Choose a valid lock and agreement from the landing.')} <Link to="/home#hardware">{t('Ver planes','View plans')}</Link></p>}
        <form onSubmit={submit} style={{display:'grid',gap:14}}>
          {([{key:'organizationName',label:t('Nombre de la organización','Organization name'),type:'text',auto:'organization'},
            {key:'fullName',label:t('Nombre completo','Full name'),type:'text',auto:'name'},
            {key:'email',label:t('Correo electrónico','Email'),type:'email',auto:'email'},
            {key:'phone',label:t('Teléfono','Phone'),type:'tel',auto:'tel'},
            {key:'password',label:t('Contraseña','Password'),type:'password',auto:'new-password'}] as const).map(field=><label key={field.key} style={{display:'grid',gap:6,fontSize:14,fontWeight:600}}>{field.label}<input required type={field.type} autoComplete={field.auto} minLength={field.key==='password'?12:undefined} maxLength={field.key==='password'?128:200} value={fields[field.key]} onChange={e=>setFields({...fields,[field.key]:e.target.value})} style={input}/></label>)}
          <p style={{fontSize:13,color:'#475569',background:'#f8fafc',padding:14,borderRadius:14,margin:0}}>{t('Contraseña: mínimo 12 caracteres, una mayúscula, una minúscula, un número y un símbolo. Sin espacios al inicio o al final ni tu correo, nombre u organización.','Password: at least 12 characters, one uppercase letter, one lowercase letter, one number and one symbol. No leading/trailing spaces or your email, name or organization.')}</p>
          {!haas && <label style={{display:'grid',gap:6,fontSize:14,fontWeight:600}}>{t('Frecuencia de pago','Billing frequency')}<select aria-label={t('Frecuencia de pago','Billing frequency')} value={billingInterval} onChange={e=>setBillingInterval(e.target.value as 'monthly'|'yearly')} style={input}><option value="monthly">{t('Mensual — $39.99 + impuestos','Monthly — $39.99 + taxes')}</option><option value="yearly">{t('Anual — $399.90 + impuestos','Annual — $399.90 + taxes')}</option></select></label>}
          {!haas && <label style={{display:'grid',gap:6,fontSize:14,fontWeight:600}}>{t('Cantidad de cerraduras','Number of locks')}<input type="number" min={1} step={1} required value={locks} onChange={e=>setLocks(Number(e.target.value))} style={input}/><span style={{fontWeight:400,color:'#475569'}}>{yearly?t('Total anual antes de descuentos e impuestos:','Annual total before discounts and taxes:'):t('Total mensual antes de descuentos e impuestos:','Monthly total before discounts and taxes:')} ${(amount*locks).toFixed(2)}</span></label>}
          {error && <p role="alert" style={{color:'#b91c1c',background:'#fef2f2',padding:14,borderRadius:14}}>{error}</p>}
          <button type="submit" disabled={submitting || !validSelection} style={{height:48,borderRadius:14,border:0,background:submitting?'#93c5fd':'#2563eb',color:'#fff',fontSize:14,fontWeight:800,cursor:'pointer'}}>{submitting?t('Abriendo pago seguro…','Opening secure checkout…'):t('Continuar al pago seguro','Continue to secure checkout')}</button>
        </form>
        <p style={{fontSize:12,color:'#6b7280',lineHeight:1.7,marginTop:18}}>{t('Al continuar, aceptas nuestros','By continuing, you agree to our')} <Link to="/legal/terms">{t('Términos de servicio','Terms of Service')}</Link>, <Link to="/legal/privacy">{t('Privacidad','Privacy Policy')}</Link>, <Link to="/legal/support-policy">{t('Soporte','Support Policy')}</Link> {t('y','and')} <Link to="/legal/billing-policy">{t('Facturación','Billing Policy')}</Link>.</p>
        <p style={{fontSize:13,color:'#6b7280'}}>{t('¿Ya tienes cuenta?','Already have an account?')} <Link to="/login">{t('Iniciar sesión','Sign in')}</Link></p>
      </section>
    </div>
  </main>;
}
