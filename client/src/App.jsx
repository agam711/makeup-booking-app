import { useState, useEffect, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════════════════ */
const C = {
  rose:"#F9C8DE", mauve:"#C97BB5", deep:"#8B3A6E",
  blush:"#FDE8F3", lav:"#EDE7F6", text:"#5C3553",
  soft:"#B08DA8", card:"#FFFFFF", dis:"#D9C8D6",
  err:"#EF5350", ok:"#66BB6A",
  grad:"linear-gradient(135deg,#F48FB1,#C97BB5)",
  bg:"linear-gradient(160deg,#FFF0F7 0%,#F3E5F5 55%,#FFF9FB 100%)",
};

/* ═══════════════════════════════════════════════════════════════
   API HELPER  (relative URLs work in dev via Vite proxy + in prod)
═══════════════════════════════════════════════════════════════ */
const api = async (path, opts = {}) => {
  const token = localStorage.getItem("admin_token");
  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
};

/* ═══════════════════════════════════════════════════════════════
   FORMAT HELPERS
═══════════════════════════════════════════════════════════════ */
const fmtIDR  = n => new Intl.NumberFormat("id-ID", { style:"currency", currency:"IDR", minimumFractionDigits:0 }).format(n);
const fmtDate = s => { if(!s) return ""; const d = new Date(s + "T12:00:00"); return d.toLocaleDateString("id-ID", { weekday:"long", day:"numeric", month:"long", year:"numeric" }); };
const uid     = () => Math.random().toString(36).slice(2,9);
const MONTHS  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW     = ["Su","Mo","Tu","We","Th","Fr","Sa"];

/* ═══════════════════════════════════════════════════════════════
   ATOMS
═══════════════════════════════════════════════════════════════ */
function Btn({ children, onClick, disabled, variant="primary", sm, style={} }) {
  const b = { border:"none", fontFamily:"inherit", cursor:disabled?"not-allowed":"pointer",
    fontWeight:700, fontSize:sm?12:14, borderRadius:sm?10:14,
    padding:sm?"7px 12px":"12px 20px", transition:"all .2s", ...style };
  if (variant==="primary") return <button onClick={onClick} disabled={disabled}
    style={{...b, background:disabled?C.dis:C.grad, color:"#fff",
    boxShadow:disabled?"none":"0 4px 16px rgba(201,123,181,.38)"}}>{children}</button>;
  if (variant==="outline") return <button onClick={onClick}
    style={{...b, background:"#fff", border:`1.5px solid ${C.rose}`, color:C.mauve}}>{children}</button>;
  if (variant==="ghost") return <button onClick={onClick}
    style={{...b, background:"transparent", border:"none", color:C.soft}}>{children}</button>;
  if (variant==="danger") return <button onClick={onClick}
    style={{...b, background:"#FFF5F5", border:`1px solid #FFCDD2`, color:C.err}}>{children}</button>;
}

function Inp({ label, value, onChange, placeholder, type="text", required, suffix }) {
  return <div style={{marginBottom:14}}>
    {label && <label style={{fontSize:11,fontWeight:700,color:C.soft,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:.6}}>
      {label}{required && <span style={{color:C.mauve}}> *</span>}
    </label>}
    <div style={{position:"relative"}}>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{width:"100%",boxSizing:"border-box",padding:`10px ${suffix?"38px":"13px"} 10px 13px`,
          borderRadius:12,border:`1.5px solid ${C.rose}`,fontSize:14,color:C.text,
          background:"#FFFBFE",outline:"none",fontFamily:"inherit"}}/>
      {suffix && <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:15,pointerEvents:"none"}}>{suffix}</span>}
    </div>
  </div>;
}

function NumInp({ label, value, onChange }) {
  return <div style={{marginBottom:12}}>
    {label && <label style={{fontSize:11,fontWeight:700,color:C.soft,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:.6}}>{label}</label>}
    <input type="number" value={value} min="0" onChange={e=>onChange(Number(e.target.value)||0)}
      style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",borderRadius:10,border:`1.5px solid ${C.rose}`,
        fontSize:13,color:C.text,background:"#FFFBFE",outline:"none",fontFamily:"inherit"}}/>
  </div>;
}

function Card({ children, style={} }) {
  return <div style={{background:C.card,borderRadius:22,padding:"20px 18px",
    boxShadow:"0 4px 24px rgba(201,123,181,.13)",marginBottom:14,...style}}>{children}</div>;
}

function Toggle({ label, value, onChange }) {
  return <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
    padding:"12px 0",borderBottom:`1px solid ${C.blush}`}}>
    <span style={{color:C.text,fontWeight:600,fontSize:14}}>{label}</span>
    <button onClick={()=>onChange(!value)} style={{width:48,height:26,border:"none",borderRadius:13,
      cursor:"pointer",flexShrink:0,background:value?C.grad:"#E0D0DC",position:"relative",padding:0,transition:"background .2s"}}>
      <div style={{width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",
        top:3,left:value?25:3,transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.2)"}}/>
    </button>
  </div>;
}

function MiniToggle({ value, onChange }) {
  return <button onClick={()=>onChange(!value)} style={{width:44,height:24,border:"none",borderRadius:12,
    cursor:"pointer",flexShrink:0,background:value?C.grad:"#E0D0DC",position:"relative",padding:0,transition:"background .2s"}}>
    <div style={{width:18,height:18,borderRadius:"50%",background:"#fff",position:"absolute",
      top:3,left:value?23:3,transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/>
  </button>;
}

function Dot({ n, active, done }) {
  return <div style={{width:30,height:30,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",
    fontSize:12,fontWeight:800,transition:"all .2s",
    background:done?C.mauve:active?C.grad:C.blush,
    color:done||active?"#fff":C.soft,
    boxShadow:active?"0 3px 12px rgba(201,123,181,.45)":"none"}}>{done?"✓":n}</div>;
}

function Alert({ type="info", children }) {
  const bg  = type==="err" ? "#FFEBEE" : C.blush;
  const bdr = type==="err" ? "#FFCDD2" : C.rose;
  const col = type==="err" ? C.err     : C.deep;
  return <div style={{background:bg,border:`1px solid ${bdr}`,borderRadius:10,
    padding:"10px 13px",marginBottom:12,fontSize:13,color:col,fontWeight:600}}>{children}</div>;
}

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" style={{flexShrink:0}}>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   AUTH SCREEN
═══════════════════════════════════════════════════════════════ */
function AuthScreen({ onAuth, onBack }) {
  const [mode,setMode]   = useState("login");
  const [name,setName]   = useState("");
  const [email,setEmail] = useState("");
  const [pwd,setPwd]     = useState("");
  const [conf,setConf]   = useState("");
  const [err,setErr]     = useState("");
  const [busy,setBusy]   = useState(false);

  const go = async () => {
    setErr(""); setBusy(true);
    try {
      if (!email || !pwd) throw new Error("Email and password are required.");
      if (mode === "register") {
        if (!name)     throw new Error("Please enter your name.");
        if (pwd.length < 6) throw new Error("Password must be at least 6 characters.");
        if (pwd !== conf) throw new Error("Passwords don't match.");
      }
      const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const { token, user } = await api(endpoint, {
        method: "POST",
        body: JSON.stringify({ name, email, password: pwd }),
      });
      localStorage.setItem("admin_token", token);
      localStorage.setItem("admin_user", JSON.stringify(user));
      onAuth(user);
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };

  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:20,fontFamily:"'Nunito',system-ui,sans-serif"}}>
      <div style={{width:"100%",maxWidth:400}}>
        {onBack && <button onClick={onBack} style={{background:"none",border:"none",color:C.soft,cursor:"pointer",
          fontSize:13,fontWeight:600,marginBottom:16,fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
          ← Back to Booking
        </button>}

        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:52,lineHeight:1,marginBottom:10}}>💄</div>
          <h1 style={{margin:0,fontSize:26,fontWeight:700,color:C.deep,fontFamily:"'Playfair Display',Georgia,serif"}}>Booking Studio</h1>
          <p style={{margin:"5px 0 0",color:C.soft,fontSize:14}}>Admin Portal — set up your booking page</p>
        </div>

        <Card>
          <div style={{display:"flex",background:C.blush,borderRadius:14,padding:3,marginBottom:20}}>
            {[["login","Sign In"],["register","Create Account"]].map(([m,l]) => (
              <button key={m} onClick={() => { setMode(m); setErr(""); }} style={{
                flex:1,padding:"10px",border:"none",borderRadius:12,cursor:"pointer",fontFamily:"inherit",
                fontWeight:700,fontSize:13,transition:"all .2s",
                background:mode===m?C.grad:"transparent",
                color:mode===m?"#fff":C.soft,
                boxShadow:mode===m?"0 2px 10px rgba(201,123,181,.3)":"none"}}>
                {l}
              </button>
            ))}
          </div>

          <div style={{display:"flex",alignItems:"center",gap:10,background:C.blush,borderRadius:12,
            padding:"10px 14px",marginBottom:18}}>
            <GoogleIcon/>
            <span style={{fontSize:12,color:C.text,fontWeight:600,lineHeight:1.5}}>
              Use your <strong>Gmail address</strong> to {mode==="login"?"sign in":"register"}
            </span>
          </div>

          {mode==="register" && <Inp label="Your Name" value={name} onChange={setName} placeholder="e.g. Mary Sari" required/>}
          <Inp label="Gmail / Email" value={email} onChange={setEmail} placeholder="yourname@gmail.com" type="email" required suffix="✉️"/>
          <Inp label="Password" value={pwd} onChange={setPwd} placeholder="At least 6 characters" type="password" required suffix="🔒"/>
          {mode==="register" && <Inp label="Confirm Password" value={conf} onChange={setConf} placeholder="Repeat password" type="password" required suffix="🔒"/>}

          {err && <Alert type="err">⚠️ {err}</Alert>}

          <Btn onClick={go} disabled={busy} variant="primary" style={{width:"100%",padding:14,fontSize:15,marginTop:4}}>
            {busy ? "Please wait…" : mode==="login" ? "Sign In →" : "Create Account →"}
          </Btn>
        </Card>

        <p style={{textAlign:"center",fontSize:12,color:C.soft,marginTop:8}}>
          {mode==="login" ? "No account yet? " : "Already registered? "}
          <button onClick={() => { setMode(m => m==="login"?"register":"login"); setErr(""); }}
            style={{background:"none",border:"none",color:C.mauve,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:12}}>
            {mode==="login" ? "Register here" : "Sign in instead"}
          </button>
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ADMIN SETTINGS SCREEN
═══════════════════════════════════════════════════════════════ */
function SettingsScreen({ cfg, setCfg, adminUser, onView, onLogout, adminId }) {
  const [tab,setTab]     = useState("branding");
  const [saved,setSaved] = useState(false);
  const [saving,setSaving]     = useState(false);
  const [calStatus,setCalStatus] = useState(null); // null | true | false
  const [bookings,setBookings]   = useState([]);
  const [bLoading,setBLoading]   = useState(false);

  useEffect(() => {
    api("/api/calendar/status").then(d => setCalStatus(d.connected)).catch(() => setCalStatus(false));
  }, []);

  useEffect(() => {
    if (tab === "bookings") {
      setBLoading(true);
      api("/api/bookings").then(setBookings).catch(()=>{}).finally(()=>setBLoading(false));
    }
  }, [tab]);

  const upd    = (k,v)    => setCfg(c => ({...c,[k]:v}));
  const updSvc = (id,k,v) => setCfg(c => ({...c,services:c.services.map(s=>s.id===id?{...s,[k]:k==="price"?+v||0:v}:s)}));
  const delSvc = id        => setCfg(c => ({...c,services:c.services.filter(s=>s.id!==id)}));
  const addSvc = ()        => setCfg(c => ({...c,services:[...c.services,{id:uid(),name:"New Service",price:300000,icon:"✨",sub:"Description here"}]}));
  const updAo  = (id,k,v) => setCfg(c => ({...c,addons:c.addons.map(a=>a.id===id?{...a,[k]:k==="price"?+v||0:v}:a)}));
  const delAo  = id        => setCfg(c => ({...c,addons:c.addons.filter(a=>a.id!==id)}));
  const addAo  = ()        => setCfg(c => ({...c,addons:[...c.addons,{id:uid(),name:"New Add-on",price:100000,icon:"✨",hasTime:false}]}));

  const save = async () => {
    setSaving(true);
    try { await api("/api/config", { method:"PUT", body:JSON.stringify({config:cfg}) }); setSaved(true); setTimeout(()=>setSaved(false),2500); }
    catch(e) { alert("Save failed: " + e.message); }
    setSaving(false);
  };

  const connectCalendar = async () => {
    try {
      const { url } = await api("/api/calendar/connect");
      const popup = window.open(url, "calendarAuth", "width=600,height=700,left=200,top=100");
      const handler = (e) => {
        if (e.data?.type === "CALENDAR_CONNECTED") {
          setCalStatus(true);
          window.removeEventListener("message", handler);
          popup?.close();
        }
      };
      window.addEventListener("message", handler);
    } catch(e) { alert("Calendar connect error: " + e.message); }
  };

  const TABS = [
    ["branding","🎨 Branding"], ["contact","📱 Contact"], ["payment","💳 Payment"],
    ["services","💄 Services"], ["addons","✨ Add-ons"], ["calendar","📅 Calendar"], ["bookings","📋 Bookings"],
  ];

  const bookingLink = `${window.location.origin}${window.location.pathname}?adminId=${adminId}`;

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Nunito',system-ui,sans-serif",padding:"20px 16px 90px"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:20}}>
        <div style={{flex:1}}>
          <h2 style={{margin:0,fontSize:20,color:C.deep,fontFamily:"'Playfair Display',serif"}}>⚙️ Admin Settings</h2>
          <p style={{margin:"2px 0 0",fontSize:12,color:C.soft}}>Welcome, {adminUser.name} 👋</p>
        </div>
        <Btn onClick={onView} variant="outline" sm>👁 Preview</Btn>
        <Btn onClick={onLogout} variant="ghost" sm style={{color:C.err}}>Sign out</Btn>
      </div>

      {/* Your booking link */}
      <Card style={{padding:"14px 16px",marginBottom:14}}>
        <p style={{margin:"0 0 6px",fontSize:12,fontWeight:700,color:C.deep}}>🔗 Your Booking Link</p>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <code style={{flex:1,fontSize:11,color:C.soft,wordBreak:"break-all",background:C.blush,borderRadius:8,padding:"8px 10px",display:"block"}}>{bookingLink}</code>
          <Btn onClick={()=>navigator.clipboard.writeText(bookingLink)} variant="outline" sm>Copy</Btn>
        </div>
      </Card>

      {/* Tabs */}
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:6,marginBottom:16,scrollbarWidth:"none"}}>
        {TABS.map(([id,lbl]) => (
          <button key={id} onClick={()=>setTab(id)} style={{padding:"8px 14px",borderRadius:20,border:"none",cursor:"pointer",
            fontFamily:"inherit",fontWeight:700,fontSize:12,whiteSpace:"nowrap",transition:"all .2s",
            background:tab===id?C.grad:C.blush,color:tab===id?"#fff":C.soft,
            boxShadow:tab===id?"0 2px 8px rgba(201,123,181,.35)":"none"}}>{lbl}</button>
        ))}
      </div>

      {/* ── BRANDING ── */}
      {tab==="branding" && <Card>
        <h3 style={{margin:"0 0 16px",color:C.deep,fontSize:16}}>🎨 App Branding</h3>
        <Inp label="App / Business Name" value={cfg.appName} onChange={v=>upd("appName",v)} placeholder="e.g. Mary's Makeup"/>
        <Inp label="Tagline" value={cfg.tagline} onChange={v=>upd("tagline",v)} placeholder="e.g. Book your glam session ✨"/>
        <div style={{background:C.blush,borderRadius:12,padding:"12px 14px",marginTop:8}}>
          <p style={{margin:0,fontSize:12,color:C.soft,lineHeight:1.6}}>💡 This name and tagline appear at the top of your booking page and on all invoices.</p>
        </div>
      </Card>}

      {/* ── CONTACT ── */}
      {tab==="contact" && <Card>
        <h3 style={{margin:"0 0 16px",color:C.deep,fontSize:16}}>📱 Contact Info</h3>
        <Inp label="WhatsApp Number" value={cfg.whatsapp} onChange={v=>upd("whatsapp",v)} placeholder="08xx-xxxx-xxxx" suffix="📞"/>
        <Inp label="Instagram Handle" value={cfg.instagram} onChange={v=>upd("instagram",v)} placeholder="@youraccount" suffix="📸"/>
        <Inp label="Instagram Profile URL" value={cfg.instagramUrl} onChange={v=>upd("instagramUrl",v)} placeholder="https://instagram.com/yourhandle"/>
      </Card>}

      {/* ── PAYMENT ── */}
      {tab==="payment" && <Card>
        <h3 style={{margin:"0 0 16px",color:C.deep,fontSize:16}}>💳 Bank Transfer Details</h3>
        <Inp label="Bank Name" value={cfg.bankName} onChange={v=>upd("bankName",v)} placeholder="e.g. BCA, BRI, Mandiri"/>
        <Inp label="Account Number" value={cfg.bankNumber} onChange={v=>upd("bankNumber",v)} placeholder="e.g. 1234 5678 90"/>
        <Inp label="Account Holder Name" value={cfg.bankHolder} onChange={v=>upd("bankHolder",v)} placeholder="Your full legal name"/>
        <div style={{background:"#FFF3E0",borderRadius:12,padding:"12px 14px",marginTop:8}}>
          <p style={{margin:0,fontSize:12,color:"#E65100",lineHeight:1.6}}>⚠️ Double-check these match your bank exactly — customers transfer directly to this account.</p>
        </div>
      </Card>}

      {/* ── SERVICES ── */}
      {tab==="services" && <>
        {(cfg.services||[]).map(s => (
          <Card key={s.id} style={{padding:"16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:22}}>{s.icon}</span>
                <span style={{fontWeight:800,color:C.deep,fontSize:13}}>{s.name}</span>
              </div>
              <Btn onClick={()=>delSvc(s.id)} variant="danger" sm>🗑 Remove</Btn>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <Inp label="Icon (emoji)" value={s.icon} onChange={v=>updSvc(s.id,"icon",v)} placeholder="🎉"/>
              <NumInp label="Price (IDR)" value={s.price} onChange={v=>updSvc(s.id,"price",v)}/>
            </div>
            <Inp label="Service Name" value={s.name} onChange={v=>updSvc(s.id,"name",v)} placeholder="Service name"/>
            <Inp label="Short Description" value={s.sub} onChange={v=>updSvc(s.id,"sub",v)} placeholder="Brief description"/>
          </Card>
        ))}
        <Btn onClick={addSvc} variant="outline" style={{width:"100%",padding:12,marginBottom:10}}>+ Add New Service</Btn>
      </>}

      {/* ── ADD-ONS ── */}
      {tab==="addons" && <>
        {(cfg.addons||[]).map(a => (
          <Card key={a.id} style={{padding:"16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:22}}>{a.icon}</span>
                <span style={{fontWeight:800,color:C.deep,fontSize:13}}>{a.name}</span>
              </div>
              <Btn onClick={()=>delAo(a.id)} variant="danger" sm>🗑 Remove</Btn>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <Inp label="Icon (emoji)" value={a.icon} onChange={v=>updAo(a.id,"icon",v)} placeholder="💇"/>
              <NumInp label="Price (IDR)" value={a.price} onChange={v=>updAo(a.id,"price",v)}/>
            </div>
            <Inp label="Add-on Name" value={a.name} onChange={v=>updAo(a.id,"name",v)} placeholder="Add-on name"/>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
              background:C.blush,borderRadius:12,padding:"10px 14px",marginTop:4}}>
              <div>
                <p style={{margin:0,fontSize:13,fontWeight:700,color:C.deep}}>Show time picker</p>
                <p style={{margin:"2px 0 0",fontSize:11,color:C.soft}}>E.g. retouch needs a specific time</p>
              </div>
              <MiniToggle value={!!a.hasTime} onChange={v=>updAo(a.id,"hasTime",v)}/>
            </div>
          </Card>
        ))}
        <Btn onClick={addAo} variant="outline" style={{width:"100%",padding:12,marginBottom:10}}>+ Add New Add-on</Btn>
      </>}

      {/* ── GOOGLE CALENDAR ── */}
      {tab==="calendar" && <Card>
        <h3 style={{margin:"0 0 16px",color:C.deep,fontSize:16}}>📅 Google Calendar</h3>
        <div style={{background:C.blush,borderRadius:14,padding:"16px",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <span style={{fontSize:22}}>{calStatus===true?"✅":"📅"}</span>
            <div>
              <p style={{margin:0,fontWeight:700,color:C.deep,fontSize:14}}>
                {calStatus===true ? "Calendar Connected!" : calStatus===false ? "Not Connected" : "Checking…"}
              </p>
              <p style={{margin:"2px 0 0",fontSize:12,color:C.soft}}>
                {calStatus===true ? "Your availability is synced automatically." : "Connect to show real availability to customers."}
              </p>
            </div>
          </div>
          {calStatus !== true && (
            <Btn onClick={connectCalendar} variant="primary" style={{width:"100%",padding:12}}>
              🔗 Connect Google Calendar
            </Btn>
          )}
        </div>
        <div style={{fontSize:12,color:C.soft,lineHeight:1.8}}>
          <p><strong>How it works:</strong></p>
          <p>① Click "Connect Google Calendar"</p>
          <p>② Sign in with your Google account</p>
          <p>③ Customers will only see dates you're free</p>
          <p>④ Confirmed bookings auto-add to your calendar</p>
        </div>
      </Card>}

      {/* ── BOOKINGS ── */}
      {tab==="bookings" && <div>
        <h3 style={{margin:"0 0 14px",color:C.deep,fontSize:16}}>📋 All Bookings</h3>
        {bLoading ? <Card><p style={{textAlign:"center",color:C.soft,padding:"20px 0"}}>Loading…</p></Card> :
         bookings.length===0 ? <Card><p style={{textAlign:"center",color:C.soft,padding:"20px 0"}}>No bookings yet 🌸</p></Card> :
         bookings.map(b => (
          <Card key={b.id} style={{padding:"14px 16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div>
                <p style={{margin:0,fontWeight:800,color:C.deep,fontSize:14}}>👤 {b.customer_name}</p>
                <p style={{margin:"2px 0 0",fontSize:12,color:C.soft}}>{b.booking_ref}</p>
              </div>
              <span style={{fontSize:12,fontWeight:700,background:b.status==="confirmed"?"#E8F5E9":"#FFF9C4",
                color:b.status==="confirmed"?C.ok:"#F9A825",borderRadius:20,padding:"3px 10px"}}>{b.status}</span>
            </div>
            <div style={{fontSize:13,color:C.text,lineHeight:1.7}}>
              📅 {b.event_date} · {b.event_time}<br/>
              💄 {b.service_name}<br/>
              📍 {b.location}<br/>
              📞 {b.customer_phone}<br/>
              <strong style={{color:C.mauve}}>💰 {fmtIDR(b.total_price)}</strong>
            </div>
          </Card>
        ))}
      </div>}

      {/* Fixed save bar (not on bookings or calendar tabs) */}
      {!["bookings","calendar"].includes(tab) && (
        <div style={{position:"fixed",bottom:0,left:0,right:0,padding:"12px 16px",
          background:"rgba(255,248,252,.96)",backdropFilter:"blur(8px)",
          borderTop:`1px solid ${C.blush}`,zIndex:100}}>
          <div style={{maxWidth:500,margin:"0 auto"}}>
            <Btn onClick={save} disabled={saving} variant="primary" style={{width:"100%",padding:13,fontSize:15}}>
              {saving ? "Saving…" : saved ? "✅ Changes Saved!" : "💾 Save All Changes"}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BOOKING SCREEN  (customer-facing, reads from API)
═══════════════════════════════════════════════════════════════ */
function BookingScreen({ cfg, adminId, isAdmin, onAdminClick }) {
  const [step,setStep]   = useState(1);
  const [avail,setAvail] = useState([]);
  const [loading,setLoading] = useState(true);
  const [vy,setVy] = useState(new Date().getFullYear());
  const [vm,setVm] = useState(new Date().getMonth());
  const [date,setDate]   = useState(null);
  const [svc,setSvc]     = useState(null);
  const [eTime,setETime] = useState("09:00");
  const [aoSt,setAoSt]   = useState({});
  const [cName,setCName] = useState("");
  const [cPhone,setCPhone]= useState("");
  const [loc,setLoc]     = useState("");
  const [eo,setEo]       = useState("");
  const [notes,setNotes] = useState("");
  const [paid,setPaid]   = useState(false);
  const [calSt,setCalSt] = useState("idle");
  const [bookingRef,setBookingRef] = useState("");

  useEffect(() => { loadAvail(); }, [adminId]);

  const loadAvail = async () => {
    setLoading(true);
    try {
      const { availableDates } = await api(`/api/calendar/available?adminId=${adminId}`);
      setAvail(availableDates || []);
    } catch {
      const fb = [], t = new Date();
      for (let i=2;i<=62;i++) { const d=new Date(t); d.setDate(t.getDate()+i); if(d.getDay()!==1) fb.push(d.toISOString().split("T")[0]); }
      setAvail(fb);
    }
    setLoading(false);
  };

  const toggleAo  = id => setAoSt(p => ({...p,[id]:{...p[id],enabled:!p[id]?.enabled,time:p[id]?.time||"16:00"}}));
  const setAoTime = (id,t) => setAoSt(p => ({...p,[id]:{...p[id],time:t}}));
  const activeAo  = () => (cfg.addons||[]).filter(a => aoSt[a.id]?.enabled);
  const total     = () => { let t=svc?.price||0; activeAo().forEach(a=>t+=a.price); return t; };

  const confirmPayment = async () => {
    setPaid(true); setCalSt("adding");
    try {
      const booking = {
        customerName:  cName,  customerPhone: cPhone,
        serviceName:   svc?.name, servicePrice: svc?.price||0,
        addons: activeAo().map(a=>({name:a.name,price:a.price,time:a.hasTime?aoSt[a.id]?.time:undefined})),
        date, eventTime: eTime, location: loc, eoContact: eo, notes, totalPrice: total(),
      };
      const { bookingRef: ref } = await api("/api/bookings", { method:"POST", body:JSON.stringify({adminId,booking}) });
      setBookingRef(ref);
      booking.bookingRef = ref;

      await api("/api/calendar/event", { method:"POST", body:JSON.stringify({adminId,booking}) });
      setCalSt("done");
    } catch (err) {
      console.error(err);
      setCalSt("done");
    }
  };

  const printInvoice = () => {
    const ref  = bookingRef || `MKP-${Date.now().toString().slice(-6)}`;
    const aoLines = activeAo().map(a => `<div class="ln"><span>${a.icon} ${a.name}${a.hasTime?" @ "+(aoSt[a.id]?.time||""):""}</span><span>${fmtIDR(a.price)}</span></div>`).join("");
    const w = window.open("","_blank");
    w.document.write(`<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>Invoice — ${ref}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Nunito:wght@400;700;800&display=swap">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Nunito',sans-serif;max-width:480px;margin:36px auto;color:#5C3553;padding:24px}
h1{font-family:'Playfair Display',serif;font-size:28px;color:#8B3A6E}.sub{color:#B08DA8;font-size:13px;margin:4px 0 18px}
hr{border:none;border-top:1.5px solid #FDE8F3;margin:14px 0}
.badge{display:inline-block;background:#FDE8F3;border-radius:20px;padding:3px 12px;font-size:12px;font-weight:700;color:#8B3A6E;margin-bottom:14px}
.lbl{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#B08DA8;margin-bottom:2px}
.val{font-size:14px;font-weight:700;color:#8B3A6E;margin-bottom:10px}
.ln{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #FDE8F3;font-size:14px}
.total{font-size:18px;font-weight:800;color:#C97BB5}
.bank{background:linear-gradient(135deg,#FFF0F7,#EDE7F6);border:1.5px solid #F9C8DE;border-radius:14px;padding:16px;margin-top:16px}
.bank h3{color:#8B3A6E;margin-bottom:10px;font-size:15px}
.br{display:flex;justify-content:space-between;padding:4px 0;font-size:14px}
.bk{color:#B08DA8}.bv{font-weight:700;color:#8B3A6E}
.foot{text-align:center;margin-top:24px;color:#B08DA8;font-size:12px;line-height:1.9}
.pBtn{width:100%;margin-top:20px;padding:13px;background:linear-gradient(135deg,#F48FB1,#C97BB5);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:800;cursor:pointer}
@media print{.pBtn{display:none}}</style></head><body>
<div style="text-align:center;margin-bottom:18px"><div style="font-size:44px;margin-bottom:8px">💄</div><h1>${cfg.appName||"Makeup Booking"}</h1><div class="sub">${cfg.tagline||""}</div></div>
<hr><div class="badge">Booking ID: ${ref}</div>
<div class="lbl">Customer</div><div class="val">${cName} · ${cPhone}</div>
<div class="lbl">Event Date & Time</div><div class="val">${fmtDate(date)} · ${eTime}</div>
<div class="lbl">Location</div><div class="val">${loc}</div>
${eo?`<div class="lbl">EO Contact</div><div class="val">${eo}</div>`:""}
${notes?`<div class="lbl">Notes</div><div class="val" style="font-weight:500">${notes}</div>`:""}
<hr><div class="ln"><span>${svc?.icon} ${svc?.name}</span><span>${fmtIDR(svc?.price||0)}</span></div>
${aoLines}<div class="ln total"><span>Total</span><span>${fmtIDR(total())}</span></div>
<div class="bank"><h3>💳 Transfer to</h3>
<div class="br"><span class="bk">Bank</span><span class="bv">${cfg.bankName||"–"}</span></div>
<div class="br"><span class="bk">No. Rekening</span><span class="bv">${cfg.bankNumber||"–"}</span></div>
<div class="br"><span class="bk">Atas Nama</span><span class="bv">${cfg.bankHolder||"–"}</span></div>
<div class="br"><span class="bk">Jumlah</span><span class="bv" style="color:#C97BB5">${fmtIDR(total())}</span></div></div>
<div class="foot"><p>Thank you for booking with ${cfg.appName||"us"} ✨</p>
${cfg.whatsapp?`<p>WhatsApp: ${cfg.whatsapp}</p>`:""}${cfg.instagram?`<p>Instagram: ${cfg.instagram}</p>`:""}</div>
<button class="pBtn" onclick="window.print()">🖨️ Print / Save as PDF</button></body></html>`);
    w.document.close();
  };

  const renderCal = () => {
    const today = new Date(); today.setHours(0,0,0,0);
    const fd = new Date(vy,vm,1).getDay(), dim = new Date(vy,vm+1,0).getDate();
    const cells = [...Array(fd).fill(null), ...Array.from({length:dim},(_,i)=>i+1)];
    const canPrev = new Date(vy,vm,1) > today;
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <button onClick={()=>{if(vm===0){setVm(11);setVy(y=>y-1);}else setVm(m=>m-1);}} disabled={!canPrev}
            style={{background:"none",border:"none",fontSize:22,cursor:canPrev?"pointer":"default",color:canPrev?C.mauve:C.dis,padding:"2px 10px"}}>‹</button>
          <span style={{fontWeight:800,fontSize:15,color:C.deep,fontFamily:"'Playfair Display',serif"}}>{MONTHS[vm]} {vy}</span>
          <button onClick={()=>{if(vm===11){setVm(0);setVy(y=>y+1);}else setVm(m=>m+1);}}
            style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:C.mauve,padding:"2px 10px"}}>›</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:6}}>
          {DOW.map(d=><div key={d} style={{textAlign:"center",fontSize:11,color:C.soft,fontWeight:700,padding:"2px 0"}}>{d}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
          {cells.map((day,i)=>{
            if(!day) return <div key={i}/>;
            const ds=`${vy}-${String(vm+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
            const cd=new Date(vy,vm,day), past=cd<today, ok=avail.includes(ds)&&!past, sel=date===ds;
            const isToday=cd.toDateString()===today.toDateString();
            return <button key={i} onClick={()=>ok&&setDate(ds)} disabled={!ok}
              style={{aspectRatio:"1",border:"none",borderRadius:10,fontSize:13,fontWeight:sel?800:500,
                cursor:ok?"pointer":"default",background:sel?C.grad:ok?C.blush:"transparent",
                color:sel?"#fff":ok?C.deep:C.dis,outline:isToday&&!sel?`2px solid ${C.rose}`:"none",outlineOffset:1,
                transform:sel?"scale(1.1)":"scale(1)",transition:"all .15s",
                boxShadow:sel?"0 3px 12px rgba(201,123,181,.4)":"none"}}>{day}</button>;
          })}
        </div>
        <div style={{display:"flex",gap:14,marginTop:12,fontSize:11,color:C.soft}}>
          {[[C.blush,C.rose,"Available"],[C.grad,"transparent","Selected"],["transparent",C.dis,"Unavailable"]].map(([bg,bdr,lbl])=>(
            <div key={lbl} style={{display:"flex",alignItems:"center",gap:4}}>
              <div style={{width:10,height:10,borderRadius:3,background:bg,border:`1.5px solid ${bdr}`,minWidth:10,flexShrink:0}}/>
              {lbl}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const STEPS = ["Date","Services","Details","Invoice"];
  const sH = (e,t,s) => <><h2 style={{margin:"0 0 3px",fontSize:20,color:C.deep,fontFamily:"'Playfair Display',serif"}}>{e} {t}</h2><p style={{margin:"0 0 18px",fontSize:13,color:C.soft}}>{s}</p></>;

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Nunito',system-ui,sans-serif",padding:"20px 16px 80px"}}>
      <div style={{textAlign:"center",marginBottom:24,paddingTop:6}}>
        <div style={{fontSize:46,lineHeight:1,marginBottom:8}}>💄</div>
        <h1 style={{margin:0,fontSize:26,fontWeight:700,color:C.deep,fontFamily:"'Playfair Display',Georgia,serif",letterSpacing:-.5}}>{cfg.appName||"Makeup Booking"}</h1>
        <p style={{margin:"4px 0 0",color:C.soft,fontSize:14,fontWeight:500}}>{cfg.tagline||"Book your glam session ✨"}</p>
      </div>

      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"center",marginBottom:24}}>
        {STEPS.map((lbl,i) => {
          const n=i+1,done=step>n,active=step===n;
          return <div key={lbl} style={{display:"flex",alignItems:"flex-start"}}>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,width:56}}>
              <Dot n={n} active={active} done={done}/>
              <span style={{fontSize:10,color:active?C.mauve:C.soft,fontWeight:active?800:500,textAlign:"center"}}>{lbl}</span>
            </div>
            {i<STEPS.length-1&&<div style={{width:20,height:2,background:step>n?C.mauve:C.blush,marginTop:14,flexShrink:0,transition:"background .3s"}}/>}
          </div>;
        })}
      </div>

      {step===1 && <Card>
        {sH("📅","Pick a Date","Available dates are highlighted in pink")}
        {loading ? <div style={{textAlign:"center",padding:"36px 0"}}><div style={{fontSize:36,marginBottom:8}}>🌸</div><p style={{color:C.soft,fontSize:14,margin:0}}>Loading schedule…</p></div> : renderCal()}
        {date && <div style={{marginTop:14,padding:"12px 16px",background:C.blush,borderRadius:14}}><p style={{margin:0,fontSize:13,color:C.deep,fontWeight:700}}>✅ {fmtDate(date)}</p></div>}
        <div style={{marginTop:14}}><Btn onClick={()=>setStep(2)} disabled={!date} variant="primary" style={{width:"100%",padding:14,fontSize:15}}>Continue →</Btn></div>
      </Card>}

      {step===2 && <>
        <Card>
          {sH("💄","Choose Makeup","What look are we going for?")}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {(cfg.services||[]).map(s => {
              const sel=svc?.id===s.id;
              return <button key={s.id} onClick={()=>setSvc(s)} style={{
                padding:"13px 10px",borderRadius:16,border:`2px solid ${sel?C.mauve:C.blush}`,
                background:sel?C.blush:C.card,cursor:"pointer",textAlign:"left",fontFamily:"inherit",
                boxShadow:sel?"0 4px 16px rgba(201,123,181,.25)":"none",transition:"all .15s"}}>
                <div style={{fontSize:26,marginBottom:5}}>{s.icon}</div>
                <div style={{fontSize:12,fontWeight:800,color:sel?C.mauve:C.text,lineHeight:1.3,marginBottom:3}}>{s.name}</div>
                <div style={{fontSize:12,color:sel?C.mauve:C.soft,fontWeight:700}}>{fmtIDR(s.price)}</div>
              </button>;
            })}
          </div>
        </Card>
        {(cfg.addons||[]).length>0 && <Card>
          <h2 style={{margin:"0 0 16px",fontSize:16,color:C.deep}}>✨ Add-ons</h2>
          {(cfg.addons||[]).map(a => (<div key={a.id}>
            <Toggle label={`${a.icon} ${a.name}  (+${fmtIDR(a.price)})`} value={!!aoSt[a.id]?.enabled} onChange={()=>toggleAo(a.id)}/>
            {a.hasTime && aoSt[a.id]?.enabled && <div style={{padding:"12px 14px",background:C.blush,borderRadius:10,margin:"4px 0 6px"}}>
              <label style={{fontSize:11,fontWeight:700,color:C.soft,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:.6}}>{a.name} Time</label>
              <input type="time" value={aoSt[a.id]?.time||"16:00"} onChange={e=>setAoTime(a.id,e.target.value)}
                style={{padding:"9px 12px",borderRadius:10,border:`1.5px solid ${C.rose}`,fontSize:14,color:C.text,background:"#fff",fontFamily:"inherit",outline:"none"}}/>
            </div>}
          </div>))}
          <div style={{marginTop:14,background:C.blush,borderRadius:12,padding:14}}>
            <label style={{fontSize:11,fontWeight:700,color:C.soft,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:.6}}>Event / Party Start Time</label>
            <input type="time" value={eTime} onChange={e=>setETime(e.target.value)}
              style={{padding:"9px 12px",borderRadius:10,border:`1.5px solid ${C.rose}`,fontSize:14,color:C.text,background:"#fff",fontFamily:"inherit",outline:"none"}}/>
          </div>
        </Card>}
        {svc && <Card style={{background:"linear-gradient(135deg,#FDE8F3,#EDE7F6)"}}>
          {[[`${svc.icon} ${svc.name}`,svc.price],...activeAo().map(a=>[`${a.icon} ${a.name}`,a.price])].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px dashed ${C.rose}40`,fontSize:14,color:C.text}}>
              <span>{k}</span><span style={{fontWeight:700}}>{fmtIDR(v)}</span>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 2px",fontWeight:800,fontSize:17,color:C.deep}}>
            <span>Estimasi Total</span><span style={{color:C.mauve}}>{fmtIDR(total())}</span>
          </div>
        </Card>}
        <div style={{display:"flex",gap:10}}>
          <Btn onClick={()=>setStep(1)} variant="outline" style={{padding:"13px 20px"}}>← Back</Btn>
          <Btn onClick={()=>setStep(3)} disabled={!svc} variant="primary" style={{flex:1,padding:13}}>Continue →</Btn>
        </div>
      </>}

      {step===3 && <>
        <Card>
          {sH("📝","Your Details","So we can prepare just for you")}
          <Inp label="Full Name" value={cName} onChange={setCName} placeholder="Your full name" required/>
          <Inp label="WhatsApp Number" value={cPhone} onChange={setCPhone} placeholder="08xx-xxxx-xxxx" type="tel" required/>
          <Inp label="Event Location" value={loc} onChange={setLoc} placeholder="e.g. Balai Kartini, Jakarta" required/>
          <div style={{marginBottom:14}}>
            <label style={{fontSize:11,fontWeight:700,color:C.soft,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:.6}}>Notes</label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Skin type, references, special requests…" rows={3}
              style={{width:"100%",boxSizing:"border-box",padding:"11px 14px",borderRadius:12,border:`1.5px solid ${C.rose}`,fontSize:14,color:C.text,background:"#FFFBFE",outline:"none",fontFamily:"inherit",resize:"none"}}/>
          </div>
          <div style={{background:C.blush,borderRadius:14,padding:14}}>
            <label style={{fontSize:11,fontWeight:700,color:C.soft,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:.6}}>EO Contact <span style={{fontWeight:400,textTransform:"none"}}>(optional)</span></label>
            <p style={{margin:"0 0 8px",fontSize:12,color:C.soft,lineHeight:1.5}}>Is there an Event Organizer managing this event?</p>
            <input type="tel" value={eo} onChange={e=>setEo(e.target.value)} placeholder="e.g. Budi EO – 0812-xxxx-xxxx"
              style={{width:"100%",boxSizing:"border-box",padding:"10px 13px",borderRadius:10,border:`1.5px solid ${C.rose}`,fontSize:14,color:C.text,background:"#fff",fontFamily:"inherit",outline:"none"}}/>
          </div>
        </Card>
        <div style={{display:"flex",gap:10}}>
          <Btn onClick={()=>setStep(2)} variant="outline" style={{padding:"13px 20px"}}>← Back</Btn>
          <Btn onClick={()=>setStep(4)} disabled={!cName||!cPhone||!loc} variant="primary" style={{flex:1,padding:13}}>See Invoice →</Btn>
        </div>
      </>}

      {step===4 && !paid && <>
        <Card>
          <div style={{textAlign:"center",marginBottom:16}}>
            <div style={{fontSize:28,marginBottom:4}}>🧾</div>
            <h2 style={{margin:"0 0 6px",fontSize:20,color:C.deep,fontFamily:"'Playfair Display',serif"}}>Booking Invoice</h2>
          </div>
          <div style={{background:C.blush,borderRadius:14,padding:"14px 16px",marginBottom:14}}>
            <div style={{fontWeight:800,color:C.deep,marginBottom:5,fontSize:15}}>👤 {cName}</div>
            <div style={{color:C.soft,fontSize:13,lineHeight:1.9}}>
              📞 {cPhone}<br/>📍 {loc}<br/>📅 {fmtDate(date)} · {eTime}
              {activeAo().filter(a=>a.hasTime).map(a=><span key={a.id}><br/>🔄 {a.name}: {aoSt[a.id]?.time}</span>)}
              {eo&&<><br/>🎪 EO: {eo}</>}
            </div>
          </div>
          {[[`${svc?.icon} ${svc?.name}`,svc?.price||0],...activeAo().map(a=>[`${a.icon} ${a.name}${a.hasTime?" @ "+(aoSt[a.id]?.time||""):""}`,a.price])].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${C.blush}`,fontSize:14,color:C.text}}>
              <span>{k}</span><span style={{fontWeight:700}}>{fmtIDR(v)}</span>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0 4px",fontWeight:800,fontSize:18,color:C.deep}}>
            <span>Total</span><span style={{color:C.mauve}}>{fmtIDR(total())}</span>
          </div>
        </Card>
        <Card style={{background:"linear-gradient(135deg,#FFF0F7,#EDE7F6)",border:`1.5px solid ${C.rose}`}}>
          <h3 style={{margin:"0 0 12px",fontSize:15,color:C.deep}}>💳 Transfer Payment To</h3>
          <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:"5px 16px",fontSize:14}}>
            {[["Bank",cfg.bankName||"–"],["No. Rekening",cfg.bankNumber||"–"],["Atas Nama",cfg.bankHolder||"–"],["Jumlah",fmtIDR(total())]].map(([k,v])=>[
              <span key={k+"k"} style={{color:C.soft,fontSize:12}}>{k}</span>,
              <span key={k+"v"} style={{fontWeight:800,color:k==="Jumlah"?C.mauve:C.deep}}>{v}</span>,
            ])}
          </div>
          <p style={{margin:"12px 0 0",fontSize:12,color:C.soft,lineHeight:1.6}}>After transfer, tap konfirmasi — booking is added to the calendar automatically 📲</p>
        </Card>
        <button onClick={printInvoice} style={{width:"100%",padding:12,borderRadius:12,border:`1.5px solid ${C.rose}`,background:"#fff",color:C.mauve,fontWeight:700,cursor:"pointer",fontSize:14,marginBottom:10,fontFamily:"inherit"}}>📄 Download / Print Invoice</button>
        <Btn onClick={confirmPayment} variant="primary" style={{width:"100%",padding:14,fontSize:15}}>✅ I've Transferred the Payment</Btn>
        <button onClick={()=>setStep(3)} style={{width:"100%",padding:10,marginTop:6,border:"none",background:"transparent",color:C.soft,fontWeight:600,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>← Edit Details</button>
      </>}

      {step===4 && paid && <Card style={{textAlign:"center",padding:"36px 20px"}}>
        <div style={{fontSize:52,marginBottom:10}}>🎉</div>
        <h2 style={{margin:"0 0 6px",fontSize:22,color:C.deep,fontFamily:"'Playfair Display',serif"}}>Booking Confirmed!</h2>
        <p style={{margin:"0 0 16px",fontSize:14,color:C.soft}}>
          {calSt==="adding"&&"✨ Adding to calendar…"}{calSt==="done"&&"✅ Calendar updated!"}
        </p>
        <div style={{background:C.blush,borderRadius:14,padding:"14px 16px",fontSize:14,textAlign:"left",lineHeight:1.9,marginBottom:14}}>
          <div style={{color:C.deep}}>📅 <strong>{fmtDate(date)}</strong> · {eTime}</div>
          <div style={{color:C.deep}}>💄 <strong>{svc?.name}</strong></div>
          {activeAo().map(a=><div key={a.id} style={{color:C.text}}>{a.icon} {a.name}{a.hasTime&&` at ${aoSt[a.id]?.time||""}`}</div>)}
          <div style={{color:C.mauve,fontWeight:800,marginTop:4}}>💰 {fmtIDR(total())} — <span style={{color:C.ok}}>Paid ✓</span></div>
        </div>
        <div style={{background:"#F3E5F5",borderRadius:12,padding:"12px 16px",fontSize:13,color:C.soft,marginBottom:12}}>
          Confirmation via WhatsApp{cfg.whatsapp?` (${cfg.whatsapp})`:""} within 1×24 hours 🌸
        </div>
        <button onClick={printInvoice} style={{width:"100%",padding:11,borderRadius:12,border:`1.5px solid ${C.rose}`,background:"#fff",color:C.mauve,fontWeight:700,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>📄 Download Invoice</button>
        {cfg.instagramUrl && <a href={cfg.instagramUrl} target="_blank" rel="noopener noreferrer"
          style={{display:"block",marginTop:10,fontSize:13,color:C.mauve,textAlign:"center",textDecoration:"none",fontWeight:600}}>
          📸 Follow {cfg.instagram||"us"} on Instagram
        </a>}
      </Card>}

      <div style={{textAlign:"center",marginTop:24}}>
        <button onClick={onAdminClick} style={{background:"none",border:`1px solid ${C.blush}`,borderRadius:20,
          padding:"6px 16px",fontSize:12,color:C.soft,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>
          {isAdmin?"⚙️ Admin Settings":"⚙️ Admin Panel"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════ */
export default function App() {
  const [view,setView]     = useState("booking");
  const [adminUser,setAdmin] = useState(null);
  const [cfg,setCfg]       = useState(null);
  const [adminId,setAdminId] = useState(1);

  useEffect(() => {
    // Read adminId from URL query param (e.g. ?adminId=2 for a specific artist)
    const params = new URLSearchParams(window.location.search);
    const aid = parseInt(params.get("adminId")) || 1;
    setAdminId(aid);

    // Restore session
    const token = localStorage.getItem("admin_token");
    const user  = localStorage.getItem("admin_user");
    if (token && user) {
      setAdmin(JSON.parse(user));
      // Verify token still valid
      api("/api/auth/me").catch(() => {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_user");
        setAdmin(null);
      });
    }

    // Load config
    api(`/api/config?adminId=${aid}`).then(setCfg).catch(() => setCfg({}));
  }, []);

  const handleAuth = user => {
    setAdmin(user);
    setAdminId(user.id);
    api(`/api/config?adminId=${user.id}`).then(setCfg);
    setView("settings");
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    setAdmin(null);
    setView("booking");
  };

  const handleSave = async newCfg => {
    await api("/api/config", { method:"PUT", body:JSON.stringify({config:newCfg}) });
    setCfg(newCfg);
  };

  if (!cfg) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#FFF0F7"}}>
      <div style={{textAlign:"center",color:"#B08DA8",fontSize:14}}>
        <div style={{fontSize:40,marginBottom:10}}>🌸</div>
        Loading…
      </div>
    </div>
  );

  if (view==="auth") return <AuthScreen onAuth={handleAuth} onBack={()=>setView("booking")}/>;

  if (view==="settings" && adminUser) return (
    <SettingsScreen
      cfg={cfg} setCfg={setCfg}
      adminUser={adminUser} adminId={adminUser.id}
      onView={()=>setView("booking")}
      onLogout={handleLogout}
    />
  );

  return <BookingScreen cfg={cfg} adminId={adminId} isAdmin={!!adminUser} onAdminClick={()=>adminUser?setView("settings"):setView("auth")}/>;
}
