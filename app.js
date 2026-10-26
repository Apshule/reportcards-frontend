(() => {
  "use strict";
  const API = "https://reportcards-api.apshule-migration.workers.dev";
  const TOKEN_KEY = "appshule_reportcards_school_jwt";
  const LEVELS = [["NURSERY","Nursery"],["PRIMARY","Primary"],["O_LEVEL","O Level"],["A_LEVEL","A Level"]];
  const MARK_ENTRY_PERIODS = [
    {value:"BOT",label:"B.O.T",title:"Beginning of Term",fields:[{key:"bot",label:"B.O.T"}]},
    {value:"MID",label:"Mid-Term",title:"Mid-Term",fields:[{key:"mid_term",label:"Mid-Term"}]},
    {value:"EOT",label:"E.O.T",title:"End of Term",fields:[{key:"eot_period",label:"E.O.T"}]},
    {value:"COMBINED_BME",label:"Combined (B.O.T + Mid + E.O.T)",title:"Combined (B.O.T + Mid + E.O.T)",fields:[{key:"bot",label:"B.O.T"},{key:"mid_term",label:"Mid-Term"},{key:"eot_period",label:"E.O.T"}]},
    {value:"COMBINED_BE",label:"Combined (B.O.T + E.O.T)",title:"Combined (B.O.T + E.O.T)",fields:[{key:"bot",label:"B.O.T"},{key:"eot_period",label:"E.O.T"}]},
    {value:"COMBINED_ME",label:"Combined (Mid + E.O.T)",title:"Combined (Mid + E.O.T)",fields:[{key:"mid_term",label:"Mid-Term"},{key:"eot_period",label:"E.O.T"}]},
  ];
  const MARK_ENTRY_LEVEL_GROUPS = [
    {value:"NURSERY",label:"Nursery( Baby - Top )",classLevels:["NURSERY","PREPRIMARY"],subjectLevels:["NURSERY","PREPRIMARY"]},
    {value:"LOWER_PRIMARY",label:"Lower Primary (P.1 - P.3)",classLevels:["PRIMARY"],subjectLevels:["PRIMARY"],classRange:[1,3]},
    {value:"UPPER_PRIMARY",label:"Upper Primary (P.4 - P.7)",classLevels:["PRIMARY"],subjectLevels:["PRIMARY"],classRange:[4,7]},
    {value:"O_LEVEL",label:"O-Level (S.1 - S.4)",classLevels:["OLEVEL","ORDINARYLEVEL"],subjectLevels:["OLEVEL","ORDINARYLEVEL"]},
    {value:"A_LEVEL",label:"A-Level (S.5 - S.6)",classLevels:["ALEVEL","ADVANCEDLEVEL"],subjectLevels:["ALEVEL","ADVANCEDLEVEL"]},
  ];
  const NURSERY_ACTIVITY_NAMES = ["Writing","Listening","Reading","Speaking","Drawing","Games","Rhymes / Stories","Music","Health Habits","Toilet Habits"];
  const requestedPath = location.pathname.replace(/\/+$/u,"")||"/";
  const authRequested = () => requestedPath==="/login"||requestedPath==="/signup";
  const landingRequested = () => requestedPath==="/";
  const authPathMode = () => "login";
  const navItems = [
    ["command-center","Command Center","fa-screwdriver-wrench"],
    ["dashboard","Dashboard","fa-house"],["classes","Classes","fa-chalkboard"],["learners","Learners","fa-user-graduate"],
    ["subjects","Subjects","fa-book-open"],["grading","Grading","fa-scale-balanced"],["teachers","Teachers","fa-chalkboard-user"],
    ["marks","Marks","fa-pen-to-square"],["projects","A-Level projects","fa-flask"],["reports","Report cards","fa-file-lines"],
    ["attendance","Attendance","fa-calendar-check"],["announcements","Announcements","fa-bullhorn"],["parent-feedback","Parent feedback","fa-comment-dots"],
    ["finance","Finance","fa-coins"],["settings","School settings","fa-calendar-days"],["review","Marks review","fa-clipboard-check"]
  ];
    const state = {token:localStorage.getItem(TOKEN_KEY)||"",school:null,user:null,role:"school_admin",mustChangePassword:false,route:"dashboard",loading:false,modal:null,toast:null,filter:{level:"",mark_entry_level:"",class_id:"",subject_id:"",academic_year:String(new Date().getFullYear()),term:"TERM_1",assessment_period:"EOT",search:""},data:{},authMode:authPathMode(),finance:{tab:"overview",term:"TERM_1",year:String(new Date().getFullYear()),loading:false,error:"",data:{},incomeFilters:{},expenseFilters:{},schoolpayFilters:{},reportClass:"",feeBalanceClass:""},rm:{classes:null,marks:null,submission:null,comments:{},signature:null,review:null,reviewBusy:false,promotionClassId:"",promotion:null,promotionBusy:false,promotionError:"",markEntryMode:"CBC",rawMarkMax:100,commentOptions:[]},parentAdmin:{announcements:[],feedback:[],loading:false,error:""}};
  const reportState = {classId:"",learnerId:"",term:"TERM_1",year:String(new Date().getFullYear()),template:"1",period:"EOT",layoutFormat:"A4",includeStamp:true,zoom:100,fullscreen:false,data:null,learners:[],busy:false,rosterBusy:false,rosterRequestId:0,rosterError:"",error:"",promotionError:"",promotionBusy:false,verifications:{},verificationBusy:false,verificationError:"",verificationRequestId:0};
  const projectState = {classId:"",term:"TERM_1",year:String(new Date().getFullYear()),data:null,busy:false,error:""};
  const root = document.getElementById("app");
  let schoolpayTimer=null;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const icon = name => `<i class="fa-solid ${name}" aria-hidden="true"></i>`;
  const MAX_LEARNER_PHOTO_BYTES=2*1024*1024;
  const levelLabel = level => LEVELS.find(x=>x[0]===level)?.[1]||level||"—";
  const isALevel = level => /^(ALEVEL|S[56])/.test(String(level||"").toUpperCase().replace(/[^A-Z0-9]/g,""));
  const normalizedMarkLevel = value => String(value||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
  function markClassGroup(item){
    const level=normalizedMarkLevel(item?.level||item?.class_level);
    const name=normalizedMarkLevel(item?.class_name||item?.name);
    if(["NURSERY","PREPRIMARY","PRESCHOOL"].includes(level))return "NURSERY";
    if(["LOWERPRIMARY"].includes(level))return "LOWER_PRIMARY";
    if(["UPPERPRIMARY"].includes(level))return "UPPER_PRIMARY";
    if(["OLEVEL","ORDINARYLEVEL"].includes(level))return "O_LEVEL";
    if(["ALEVEL","ADVANCEDLEVEL"].includes(level))return "A_LEVEL";
    const secondary=name.match(/^S([1-6])(?:[A-Z]+)?$/u);
    if(secondary)return Number(secondary[1])<=4?"O_LEVEL":"A_LEVEL";
    const primary=name.match(/^(?:P|PRIMARY)([1-7])(?:[A-Z]+)?$/u);
    if(primary)return Number(primary[1])<=3?"LOWER_PRIMARY":"UPPER_PRIMARY";
    return null;
  }
  function markEntryLevelForClass(classes,classId,preferred=""){
    if(MARK_ENTRY_LEVEL_GROUPS.some(group=>group.value===preferred))return preferred;
    const selected=(classes||[]).find(item=>String(item.id??item.class_id)===String(classId));
    const selectedGroup=selected?markClassGroup(selected):null;
    if(selectedGroup)return selectedGroup;
    return MARK_ENTRY_LEVEL_GROUPS.find(group=>(classes||[]).some(item=>markClassGroup(item)===group.value))?.value||MARK_ENTRY_LEVEL_GROUPS[0].value;
  }
  function markClassesForLevel(classes,groupValue){
    const unique=(classes||[]).filter((item,index,list)=>list.findIndex(other=>String(other.id??other.class_id)===String(item.id??item.class_id))===index);
    return unique.filter(item=>markClassGroup(item)===groupValue);
  }
  function markSubjectsForLevel(subjects,groupValue){
    const group=MARK_ENTRY_LEVEL_GROUPS.find(item=>item.value===groupValue);
    if(!group)return[];
    return (subjects||[]).filter(subject=>group.subjectLevels.includes(normalizedMarkLevel(subject.level)));
  }
  function markEntryLevelOptions(selected){
    return MARK_ENTRY_LEVEL_GROUPS.map(group=>`<option value="${group.value}" ${group.value===selected?"selected":""}>${esc(group.label)}</option>`).join("");
  }
  function markEntryClassOptions(classes,selectedId,groupValue){
    const rows=markClassesForLevel(classes,groupValue);
    return `<option value="">${rows.length?"Choose a class":"No classes in this level"}</option>${rows.map(item=>{const id=item.id??item.class_id,name=item.name??item.class_name;return `<option value="${esc(id)}" ${String(id)===String(selectedId)?"selected":""}>${esc(name)}${item.stream?` · ${esc(item.stream)}`:""}</option>`}).join("")}`;
  }
  const fmt = value => value===null||value===undefined||value===""?"—":esc(value);
  const idOf = item => item?.id ?? "";
  function toast(message,kind="success"){state.toast={message,kind};render();setTimeout(()=>{state.toast=null;render()},4000)}
  function schoolName(){return state.school?.name||state.school?.school_name||"School office"}
  function schoolLogoSource(value){const raw=String(value||"").trim();if(!raw)return"";if(/^data:image\/(?:png|jpe?g|webp);base64,/iu.test(raw)||/^https?:\/\//iu.test(raw)||/^\/[^/]/u.test(raw))return raw;return`data:image/jpeg;base64,${raw.replace(/\s/gu,"")}`}
  function readImageFile(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error("The school logo could not be read."));reader.onload=()=>typeof reader.result==="string"?resolve(reader.result):reject(new Error("The school logo could not be read."));reader.readAsDataURL(file)})}
  function greetingName(){return state.role==="teacher"?(state.user?.name||"Teacher"):(state.school?.head_teacher_name||state.school?.name||"Administrator")}
  function timeGreeting(){const hour=new Date().getHours();return hour<12?"Good morning":hour<17?"Good afternoon":"Good evening"}
  function hasFinanceAccess(){return ["school_admin","bursar","head_teacher","director"].includes(state.role)}
  function initialAuthenticatedRoute(defaultRoute){
    if(landingRequested()||authRequested())return defaultRoute;
    if(state.role==="super_admin")return "command-center";
    const pathRoute=requestedPath.slice(1);
    const hashRoute=location.hash.slice(1);
    const requested=navItems.some(item=>item[0]===hashRoute)?hashRoute:navItems.some(item=>item[0]===pathRoute)?pathRoute:defaultRoute;
    if(requested==="finance"&&!hasFinanceAccess())return defaultRoute;
    if(requested==="command-center"&&state.role!=="super_admin")return defaultRoute;
    if(["settings","reports","review"].includes(requested)&&state.role!=="school_admin")return defaultRoute;
    if(state.role==="teacher"&&!["dashboard","marks","attendance"].includes(requested))return defaultRoute;
    if(["announcements","parent-feedback"].includes(requested)&&state.role!=="school_admin")return defaultRoute;
    if(["bursar","head_teacher","director"].includes(state.role)&&requested!=="finance")return defaultRoute;
    return requested;
  }
  function visibleNavItems(){if(state.role==="super_admin")return navItems.filter(item=>item[0]==="command-center");if(state.role==="teacher")return navItems.filter(item=>["dashboard","marks","attendance"].includes(item[0]));return ["bursar","head_teacher","director"].includes(state.role)?navItems.filter(item=>item[0]==="finance"):navItems.filter(item=>item[0]!=="command-center"&&(item[0]!=="finance"||state.role==="school_admin")&&(item[0]!=="settings"||state.role==="school_admin")&&(item[0]!=="reports"||state.role==="school_admin")&&(item[0]!=="review"||state.role==="school_admin")&&(!["announcements","parent-feedback"].includes(item[0])||state.role==="school_admin"))}
  async function api(path,{method="GET",body,auth=true,cache="no-store"}={}){
    const headers={"Content-Type":"application/json"};
    if(auth&&state.token)headers.Authorization=`Bearer ${state.token}`;
    let response;
    try { response=await fetch(API+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache}); }
    catch { throw new Error("Could not reach the API. Check your connection and try again."); }
    let payload={};try{payload=await response.json()}catch{}
    if(response.status===401&&auth){logout(false);throw new Error(payload.error||"Your session has expired. Please sign in again.");}
    if(!response.ok)throw new Error(payload.error||`Request failed (${response.status}).`);
    return payload;
  }
  async function verifySession(){
    if(!state.token){render();return}
    try{
      const me=await api("/api/auth/me");
       if(me.type==="school"&&me.school){state.school=me.school;state.user=null;state.role="school_admin";state.mustChangePassword=me.must_change_password===true;state.route=initialAuthenticatedRoute("dashboard");if(landingRequested()||authRequested())history.replaceState(null,"",`/${state.route}`);render();if(!state.mustChangePassword)await loadRoute(state.route);return}
       if(me.type==="user"&&me.user){state.user=me.user;state.school=me.school||null;state.role=me.role||me.user.finance_role||me.user.role||"teacher";if(state.role==="parent"){location.replace("/parent-dashboard.html");return}state.mustChangePassword=me.must_change_password===true;state.route=initialAuthenticatedRoute(state.role==="super_admin"?"command-center":["bursar","head_teacher","director"].includes(state.role)?"finance":"dashboard");if(state.route==="finance")state.finance.tab="overview";if(landingRequested()||authRequested())history.replaceState(null,"",`/${state.route}`);state.modal=null;render();if(!state.mustChangePassword)await loadRoute(state.route);return}
      throw new Error("Account details were unavailable.");
    }catch{state.token="";state.school=null;state.user=null;state.role="school_admin";state.mustChangePassword=false;state.modal=null;localStorage.removeItem(TOKEN_KEY);render()}
  }
  function logout(show=true){state.token="";state.school=null;state.user=null;state.role="school_admin";state.mustChangePassword=false;state.data={};state.finance.data={};state.loading=false;localStorage.removeItem(TOKEN_KEY);localStorage.removeItem("appshule_reportcards_parent_jwt");state.route="dashboard";state.modal=null;configureFinancePolling();render();if(show)toast("You have signed out.");}
  function go(route){if(state.mustChangePassword)return;if(state.role==="super_admin"&&route!=="command-center")return;if(route==="command-center"&&state.role!=="super_admin")return;if(route==="finance"&&!hasFinanceAccess())return;if((route==="settings"||route==="reports"||route==="review"||route==="announcements"||route==="parent-feedback")&&state.role!=="school_admin")return;if(state.role==="teacher"&&!["dashboard","marks","attendance"].includes(route))return;if(["bursar","head_teacher","director"].includes(state.role)&&route!=="finance")return;state.route=route;state.modal=null;configureFinancePolling();if(location.hash!==`#${route}`)location.hash=route;document.querySelector(".sidebar")?.classList.remove("open");document.querySelector(".sidebar-scrim")?.remove();render();loadRoute(route)}
  function shell(content){
    const routeName=navItems.find(n=>n[0]===state.route)?.[1]||"Dashboard";
    const actorRole=state.role==="school_admin"?"Administrator":state.role.replaceAll("_"," ");
    return `<div class="app-shell"><aside class="sidebar" id="sidebar"><div class="brand"><span class="brand-mark"></span>appshule</div><div class="nav-label">School office</div><nav class="nav-list" aria-label="Main navigation">${visibleNavItems().map(([route,label,ico])=>`<a class="nav-link ${state.route===route?"active":""}" href="#${route}" data-route="${route}" ${state.route===route?'aria-current="page"':""}>${icon(ico)}<span>${label}</span></a>`).join("")}</nav><div class="sidebar-bottom"><div class="school-chip"><div class="school-avatar">${esc(schoolName().slice(0,1).toUpperCase())}</div><div class="school-info"><strong>${esc(schoolName())}</strong><span>${esc(actorRole)}</span></div></div><button class="btn logout" data-action="logout">${icon("fa-arrow-right-from-bracket")} Sign out</button></div></aside><main class="main"><header class="topbar"><div class="topbar-left"><button class="menu-toggle" aria-label="Open navigation" data-action="menu">${icon("fa-bars")}</button><span class="crumb">School office / <strong>${esc(routeName)}</strong></span></div><span class="topbar-date">${new Date().toLocaleDateString("en-UG",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</span></header><section class="page">${content}</section></main>${state.modal?modalMarkup():""}${state.toast?`<div class="toast ${state.toast.kind}" role="status">${icon(state.toast.kind==="error"?"fa-circle-exclamation":"fa-circle-check")} ${esc(state.toast.message)}</div>`:""}</div>`;
  }
  function heading(title,subtitle,action=""){if(title==="Good morning"||title.startsWith("Welcome"))title=`${timeGreeting()}, ${esc(greetingName())}`;return `<div class="page-heading"><div><p class="eyebrow">AppShule · School office</p><h1>${title}</h1><p>${subtitle}</p></div>${action?`<div class="page-actions">${action}</div>`:""}</div>`}
  function button(label,action,ico="fa-plus",cls="btn-primary"){return `<button class="btn ${cls}" data-action="${action}">${icon(ico)}${label}</button>`}
  function metric(title,value,ico,foot=""){return `<article class="card stat-card"><div class="stat-head"><span>${title}</span><span class="stat-icon">${icon(ico)}</span></div><div class="stat-value">${fmt(value)}</div><div class="stat-foot">${foot}</div></article>`}
  function empty(title,description,act=""){return `<div class="empty-state"><div class="empty-icon">${icon("fa-inbox")}</div><h3>${title}</h3><p>${description}</p>${act}</div>`}
  function loading(){return `<div class="card section-card"><div class="loading-row">Loading records</div><div class="loading-row" style="margin-top:10px">Loading records</div><div class="loading-row" style="margin-top:10px">Loading records</div></div>`}
  function errorBox(error,retry="reload"){return `<div class="alert error" role="alert">${icon("fa-circle-exclamation")} ${esc(error)} <button class="text-button" data-action="${retry}">Try again</button></div>`}
  async function loadRoute(route=state.route){
    if(!state.token)return;
    try{
      if(route==="dashboard"&&state.role==="teacher")await loadTeacherClasses();
      else if(route==="dashboard")await loadDashboard();
      else if(route==="command-center"){
        if(state.role!=="super_admin")throw new Error("Command Center access is restricted.");
        state.data.commandCenter=null;state.data.commandCenterError="";state.data.commandCenterSummary=null;render();
        const [result,bundleResult]=await Promise.all([
          api("/api/command-center/schools"),
          api("/api/command-center/sms-bundles"),
        ]);
        state.data.commandCenter=result;
        state.data.commandCenterSummary=result.summary||{};
        state.data.commandCenterBundles=bundleResult.bundles||[];
      }
      else if(route==="marks"&&state.role==="teacher"){await loadTeacherClasses();if(state.filter.class_id&&state.filter.subject_id)await loadTeacherMarks()}
       else if(route==="classes"){state.data.classes=null;render();const [classes,teachers]=await Promise.all([api("/api/classes"),api("/api/teachers")]);state.data.classes=classes.classes||[];state.data.teachers=teachers.teachers||[];}
      else if(route==="learners"){state.data.classes=state.data.classes||((await api("/api/classes")).classes||[]);state.data.learners=null;render();const q=new URLSearchParams();if(state.filter.class_id)q.set("class_id",state.filter.class_id);if(state.filter.search)q.set("search",state.filter.search);state.data.learners=(await api("/api/learners?"+q)).learners||[];}
      else if(route==="subjects"){state.data.subjects=null;state.data.subjectsError=null;render();let q=state.filter.level?`?level=${encodeURIComponent(state.filter.level)}`:"";state.data.subjects=(await api("/api/subjects"+q,{cache:"no-store"})).subjects||[];}
       else if(route==="grading"){state.data.grading=null;render();let q=state.filter.level?`?level=${encodeURIComponent(state.filter.level)}`:"";const [result,subjectsResult]=await Promise.all([api("/api/grading"+q),api("/api/subjects")]);state.data.subjects=subjectsResult.subjects||[];state.data.grading=result.grading||[];state.data.subjectGrading=result.subject_grading||[];state.data.activeGradingScale=result.active_scale||null;state.data.gradingScales=result.scales||[];state.data.activeGradingScales=result.active_scales||[];state.data.gradingPointsScheme=result.points_scheme||{};}
      else if(route==="teachers"){state.data.teachers=null;render();state.data.teachers=(await api("/api/teachers")).teachers||[];state.data.classes=(await api("/api/classes")).classes||[];state.data.subjects=(await api("/api/subjects")).subjects||[];}
      else if(route==="marks"){state.data.classes=state.data.classes||((await api("/api/classes")).classes||[]);state.data.subjects=state.data.subjects||((await api("/api/subjects")).subjects||[]);await loadMarks()}
      else if(route==="projects"){state.data.classes=state.data.classes||((await api("/api/classes")).classes||[]);if(!projectState.classId)projectState.classId=state.data.classes.find(c=>isALevel(c.level))?.id||"";await loadProjectRegister()}
      else if(route==="projects"){state.data.classes=state.data.classes||((await api("/api/classes")).classes||[]);if(!projectState.classId)projectState.classId=state.data.classes.find(c=>isALevel(c.level))?.id||"";await loadProjectRegister()}
       else if(route==="reports"){state.data.classes=state.data.classes||((await api("/api/classes")).classes||[]);if(!reportState.classId&&state.data.classes.length)reportState.classId=state.data.classes[0].id;await loadReportLearners(reportState.classId);}
      else if(route==="attendance"){if(!["teacher","school_admin"].includes(state.role))throw new Error("Attendance access is not assigned to this account.");await window.ReportCardsAttendance?.load(api)}
      else if(route==="announcements"){if(state.role!=="school_admin")throw new Error("Only school administrators can publish announcements.");state.parentAdmin.error="";state.parentAdmin.announcements=(await api("/api/parents/announcements")).announcements||[]}
      else if(route==="parent-feedback"){if(state.role!=="school_admin")throw new Error("Only school administrators can view parent feedback.");state.parentAdmin.error="";state.parentAdmin.feedback=(await api("/api/parents/feedback")).feedback||[]}
      else if(route==="finance"){if(!hasFinanceAccess())throw new Error("Finance access is not assigned to this account.");await loadFinanceTab()}
        else if(route==="settings"){
         if(state.role!=="school_admin")throw new Error("School settings are only available to school administrators.");
         state.data.settingsTab=state.data.settingsTab||"general";state.data.schoolSettings=null;state.data.promotionSettings=null;state.data.settingsError=null;state.data.subjectsError=null;state.data.gradingError=null;state.data.activityIconError="";state.data.stampError="";state.data.smsWalletError="";render();
         const [schoolResult,stampResult,financeResult,subjectsResult,gradingResult,activityIconResult]=await Promise.all([api("/api/school/me"),api("/api/schools/stamp"),api("/api/fin/settings"),api("/api/subjects"),api("/api/grading"),api("/api/school/activity-icons")]);
         state.data.schoolSettings=schoolResult.school||null;state.data.subjects=subjectsResult.subjects||[];state.data.grading=gradingResult.grading||[];state.data.subjectGrading=gradingResult.subject_grading||[];state.data.activeGradingScale=gradingResult.active_scale||null;state.data.gradingScales=gradingResult.scales||[];state.data.activeGradingScales=gradingResult.active_scales||[];state.data.gradingPointsScheme=gradingResult.points_scheme||{};state.data.activityIcons=activityIconResult.icons||[];
         state.data.stampConfig={...(stampResult.stamp_config||{}),show_stamp:stampResult.show_stamp!==false,stamp_logo_position:stampResult.stamp_logo_position||"inside_center",stamp_logo_size:stampResult.stamp_logo_size??20,stamp_logo_offset_x:stampResult.stamp_logo_offset_x??0,stamp_logo_offset_y:stampResult.stamp_logo_offset_y??0,stamp_logo_rotation:stampResult.stamp_logo_rotation??0,stamp_logo_opacity:stampResult.stamp_logo_opacity??100};
         state.data.promotionSettings=financeResult.settings||{promotion_pass_mark:50,promotion_try_another_min:40};
         try{state.data.smsWallet=await api("/api/sms/wallet")}catch(error){state.data.smsWalletError=error.message||"SMS wallet details could not be loaded."}
        }
      else if(route==="review"&&state.role==="school_admin")await loadReviewQueue();
    }catch(error){if(["announcements","parent-feedback"].includes(route))state.parentAdmin.error=error.message;else if(route==="command-center")state.data.commandCenterError=error.message;else state.data[route+"Error"]=error.message}
    render();
  }
  function financePeriodQuery(extra={}){
    const query=new URLSearchParams({term:state.finance.term,year:String(state.finance.year),...extra});
    return query.toString();
  }
  async function loadFinanceTab(){
    const f=state.finance;f.loading=true;f.error="";render();
    try{
      if(f.tab==="overview")f.data.summary=await api(`/api/fin/summary?${financePeriodQuery()}`);
      else if(f.tab==="income"){
        f.data.lookups=f.data.lookups||await api("/api/fin/lookups");
        const filters={term:f.term,year:f.year,...f.incomeFilters};
        const query=new URLSearchParams(Object.entries(filters).filter(([,v])=>v));
        f.data.income=(await api(`/api/fin/income?${query}`)).income||[];
      }else if(f.tab==="expenses"){
        f.data.lookups=f.data.lookups||await api("/api/fin/lookups");
        const query=new URLSearchParams({term:f.term,year:String(f.year),...(f.expenseFilters||{})});
        f.data.expenses=(await api(`/api/fin/expenses?${query}`)).expenses||[];
      }else if(f.tab==="schoolpay"){
        f.data.lookups=f.data.lookups||await api("/api/fin/lookups");
        const query=new URLSearchParams(f.schoolpayFilters||{});
        f.data.transactions=(await api(`/api/fin/schoolpay/transactions?${query}`)).transactions||[];
      }else if(f.tab==="fee-structure"){
        f.data.lookups=f.data.lookups||await api("/api/fin/lookups");
        f.data.feeStructure=(await api(`/api/fin/fee-structure?${financePeriodQuery()}`)).fee_structure||[];
      }else if(f.tab==="budget")f.data.budget=(await api(`/api/fin/budget?${financePeriodQuery()}`)).budget||[];
      else if(f.tab==="reports"){
        f.data.lookups=f.data.lookups||await api("/api/fin/lookups");
        const shared=financePeriodQuery();
        const byLearner=new URLSearchParams({term:f.term,year:String(f.year)});
        if(f.reportClass)byLearner.set("class_id",f.reportClass);
        const [byClass,byLearnerRows,byCategory,budgetVsActual,outstanding]=await Promise.all([
          api(`/api/fin/reports/by-class?${shared}`),
          api(`/api/fin/reports/by-learner?${byLearner}`),
          api(`/api/fin/reports/by-category?${shared}`),
          api(`/api/fin/reports/budget-vs-actual?${shared}`),
          api(`/api/fin/reports/outstanding-fees?${shared}`),
        ]);
        f.data.reports={byClass:byClass.rows||[],byLearner:byLearnerRows.rows||[],byCategory:byCategory.rows||[],budgetVsActual:budgetVsActual.rows||[],outstanding:outstanding.rows||[]};
      }else if(f.tab==="settings"){
        const result=await Promise.all([api("/api/fin/settings"),api("/api/fin/roles")]);
        f.data.settings=result[0];f.data.roles=result[1];
      }
    }catch(error){f.error=error.message}
    finally{f.loading=false;configureFinancePolling()}
  }
  function configureFinancePolling(){
    if(schoolpayTimer){clearInterval(schoolpayTimer);schoolpayTimer=null}
    if(state.route==="finance"&&state.finance.tab==="schoolpay"){
      schoolpayTimer=setInterval(()=>{if(state.route==="finance"&&state.finance.tab==="schoolpay"&&!state.finance.loading)loadFinanceTab()},30000);
    }
  }
  async function loadDashboard(){state.data.dashboard=null;state.data.dashboardError=null;render();try{state.data.dashboard=await api("/api/dashboard")}catch(error){state.data.dashboardError=error.message}render()}
  async function loadMarks(){
    state.data.marks=null;state.data.marksError=null;render();
    if(!state.filter.class_id||!state.filter.subject_id){state.data.marks=[];render();return}
    const selectedClass=(state.data.classes||[]).find(c=>String(c.id)===String(state.filter.class_id));
    const groupValue=markEntryLevelForClass(state.data.classes||[],state.filter.class_id,state.filter.mark_entry_level);
    const validSubject=markSubjectsForLevel(state.data.subjects||[],groupValue).some(subject=>String(subject.id)===String(state.filter.subject_id));
    if(!selectedClass||markClassGroup(selectedClass)!==groupValue||!validSubject){
      state.filter.class_id="";
      state.filter.subject_id="";
      state.data.marks=[];
      render();
      return;
    }
    const q=new URLSearchParams({class_id:state.filter.class_id,subject_id:state.filter.subject_id,academic_year:state.filter.academic_year,term:state.filter.term});
    try{
      const level=selectedClass.level;
      const [marks,grading]=await Promise.all([api("/api/marks?"+q),api("/api/grading"+(level?`?level=${encodeURIComponent(level)}`:""))]);
      state.data.marks=marks.marks||[];state.data.grading=grading.grading||[];state.data.subjectGrading=grading.subject_grading||[];state.data.activeGradingScale=grading.active_scale||null;state.data.gradingScales=grading.scales||[];state.data.activeGradingScales=grading.active_scales||[];state.data.gradingPointsScheme=grading.points_scheme||{};state.data.commentOptions=[...new Set((grading.grading||[]).map(row=>String(row.comment||"").trim()).filter(Boolean))];state.data.markEntryMode=marks.mark_entry_mode||"CBC";state.data.rawMarkMax=Number(marks.raw_mark_max)||100;
    }catch(error){state.data.marksError=error.message}
    render();
  }
  async function loadProjectRegister(){
    projectState.error="";
    state.data.projectRegister=null;
    if(!projectState.classId){projectState.busy=false;render();return}
    if(!/^\d{4}$/.test(String(projectState.year))){projectState.error="Enter a valid four-digit year.";projectState.busy=false;render();return}
    projectState.busy=true;render();
    const query=new URLSearchParams({term:projectState.term,year:String(projectState.year)});
    try{state.data.projectRegister=await api(`/api/class/${encodeURIComponent(projectState.classId)}/projects?${query}`)}
    catch(error){projectState.error=error.message}
    finally{projectState.busy=false;render()}
  }
  function dashboard(){
    if(state.role==="teacher")return teacherDashboard();
    const data=state.data.dashboard;
    const err=state.data.dashboardError;
    if(!data)return `${heading(`${timeGreeting()}, ${esc(greetingName())}`,"Your school at a glance.")}${err?errorBox(err,"dashboard"):`${loading()}`}`;
    const s=data.stats||{};
    const recent=data.recent_learners||[];
    return `${heading(`Welcome, ${esc(state.school?.head_teacher_name||state.school?.name||"Administrator")}`, "Here is the latest from your school.")}<div class="stats-grid">${metric("Classes",s.classes,"fa-chalkboard","Active classes")}${metric("Learners",s.learners,"fa-user-graduate","On your register")}${metric("Subjects",s.subjects,"fa-book-open","Across levels")}${metric("Teachers",s.teachers,"fa-chalkboard-user","On your staff")}</div><div class="content-grid"><section class="card section-card"><div class="section-title"><div><h2>Recently added learners</h2><p>New additions to your school register</p></div><a class="text-button" href="#learners" data-route="learners">View learners</a></div>${recent.length?`<div class="table-wrap"><table><thead><tr><th>Learner</th><th>Registration no.</th><th>Class</th></tr></thead><tbody>${recent.slice(0,6).map(l=>`<tr><td class="row-primary">${esc(l.full_name)}</td><td>${fmt(l.reg_no)}</td><td>${fmt(l.class_name)}</td></tr>`).join("")}</tbody></table></div>`:empty("Your register starts here","Once you add learners, your recent activity will appear here.",button("Add learners","add-learner","fa-user-plus"))}</section><section class="card section-card"><div class="section-title"><div><h2>Quick actions</h2><p>Keep the school day moving</p></div></div><div class="quick-grid"><a class="quick-link" href="#classes" data-route="classes">${icon("fa-chalkboard")} Add a class</a><a class="quick-link" href="#learners" data-route="learners">${icon("fa-user-plus")} Register learners</a><a class="quick-link" href="#marks" data-route="marks">${icon("fa-pen-to-square")} Enter marks</a><a class="quick-link" href="#teachers" data-route="teachers">${icon("fa-user-tie")} Manage teachers</a></div></section></div>`;
  }
  async function loadTeacherClasses(){
    const rm=state.rm;rm.classes=null;rm.error="";rm.signatureStatus={text:"Loading saved signature…",kind:"success"};render();
    try{const result=await api("/api/rm/my-classes");rm.classes=result.classes||[];if(rm.classes.length){const selected=rm.classes.find(c=>String(c.class_id)===String(state.filter.class_id)&&String(c.subject_id||"")===String(state.filter.subject_id||""))||rm.classes[0];state.filter.class_id=String(selected.class_id);state.filter.subject_id=String(selected.subject_id||"");state.filter.mark_entry_level=markEntryLevelForClass(rm.classes,selected.class_id,markClassGroup(selected))}try{rm.signature=(await api("/api/rm/teachers/signature")).signature||null;rm.signatureStatus=null}catch(error){rm.signature=null;rm.signatureStatus={text:`Could not load saved signature: ${error.message}`,kind:"error"}}}catch(error){rm.error=error.message}
    render();
  }
  function teacherDashboard(){
    const assigned=state.rm.classes||[];
     return `${heading(`Welcome${state.user?.name?`, ${esc(state.user.name)}`:""}`,"Your assigned classes and learning areas, ready for the next assessment.")}${state.rm.error?errorBox(state.rm.error,"marks"):""}<section class="card section-card teacher-welcome"><div><span class="eyebrow">Teaching workspace</span><h2>${assigned.length} assigned ${assigned.length===1?"class":"class and subject pair"}${assigned.length===1?"":"s"}</h2><p>Marks and learner comments stay limited to your teaching assignments.</p></div><button class="btn btn-primary" data-route="marks">${icon("fa-pen-to-square")} Enter marks</button></section><section class="assigned-grid">${assigned.length?assigned.map(c=>`<article class="card assignment-card"><div class="assignment-icon">${icon("fa-book-open")}</div><div><span class="badge">${esc(levelLabel(c.level))}</span><h3>${esc(c.class_name)}</h3><p>${esc(c.subject_name||"Class teacher comments")}${c.is_class_teacher?' · Class teacher':""}</p></div><button class="btn btn-quiet" data-action="open-assigned" data-class="${esc(c.class_id)}" data-subject="${esc(c.subject_id||"")}">${c.subject_id?"Open register":"Open class comments"} ${icon("fa-arrow-right")}</button></article>`).join(""):state.rm.classes===null?loading():empty("No teaching assignments yet","Ask your school administrator to assign your classes and subjects.")}</section>${signaturePanel()}`;
  }
  function periodQuery(){return new URLSearchParams({subject_id:state.filter.subject_id,term:state.filter.term,year:String(state.filter.academic_year)}).toString()}
  async function loadTeacherMarks(){
    const rm=state.rm;rm.marks=null;rm.error="";render();
       try{const result=await api(`/api/rm/class/${encodeURIComponent(state.filter.class_id)}/marks?${periodQuery()}`);rm.marks=result.learners||[];rm.class=result.class;rm.subject=result.subject;rm.submission=result.submission||null;rm.markEntryMode=result.mark_entry_mode||"CBC";rm.rawMarkMax=Number(result.raw_mark_max)||100;rm.commentOptions=result.comment_options||[];rm.gradeScales=result.grade_scales||[];rm.subjectGradeScales=result.subject_grade_scales||[];rm.activeGradingScale=result.active_grading_scale||null;rm.gradingPointsScheme=result.grading_points_scheme||{};rm.comments=Object.fromEntries(rm.marks.map(learner=>[learner.learner_id,learner.class_teacher_comment||""]))}catch(error){rm.error=error.message}
    render();
  }
   function signaturePanel(){const sig=state.rm.signature;return `<section class="card section-card signature-card"><div class="section-title"><div><h2>Teacher signature</h2><p>Upload a signature image or draw one below. Saved for your account.</p></div></div>${state.rm.signatureStatus?`<div class="alert ${state.rm.signatureStatus.kind}" role="status">${esc(state.rm.signatureStatus.text)}</div>`:""}${sig?.data_url?`<img class="signature-preview" src="${esc(sig.data_url)}" alt="Saved teacher signature">`:""}<div class="signature-tools"><label class="btn btn-outline upload-signature">${icon("fa-upload")} Upload image<input type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" data-signature-file></label><button class="btn btn-quiet" data-action="clear-signature">${icon("fa-eraser")} Clear canvas</button><button class="btn btn-primary" data-action="save-signature">${icon("fa-floppy-disk")} Save signature</button></div><canvas id="signature-canvas" width="600" height="160" aria-label="Signature drawing canvas" tabindex="0" role="application"></canvas><p class="field-hint">Draw with pointer or touch. Keyboard: focus the canvas, then use arrow keys to draw; hold Shift to erase.</p></section>`}
  function teacherMarksPage(){
      const list=state.rm.classes||[];
      const groupValue=markEntryLevelForClass(list,state.filter.class_id,state.filter.mark_entry_level);
      const filteredAssignments=list.filter(c=>markClassGroup(c)===groupValue);
      const matching=filteredAssignments.filter(c=>String(c.class_id)===String(state.filter.class_id)),subjects=matching.filter(c=>c.subject_id);
      const selectedSubject=subjects.find(c=>String(c.subject_id)===String(state.filter.subject_id));
     const aLevel=matching.some(c=>isALevel(c.level));
      const period=markEntryPeriod();
     const classOptionsMarkup=markEntryClassOptions(list,state.filter.class_id,groupValue);
     const isClassTeacher=matching.some(c=>c.is_class_teacher);
      const subjectOptions=`${isClassTeacher?`<option value="" ${!state.filter.subject_id?"selected":""}>Class teacher comments</option>`:""}${subjects.map(c=>`<option value="${esc(c.subject_id)}" ${String(c.subject_id)===String(state.filter.subject_id)?"selected":""}>${esc(c.subject_name)}${c.is_compulsory?" *":""}${c.category==="OTHER"?" · Other":""}</option>`).join("")}`;
     const commentOnly=isClassTeacher&&!state.filter.subject_id;
    const learners=state.rm.marks||[];
     const actions=commentOnly?"":`<button class="btn btn-outline" data-action="save-teacher-marks" ${!learners.length?"disabled":""}>${icon("fa-floppy-disk")} Save draft</button><button class="btn btn-primary" data-action="submit-marks-review" ${!learners.length||["submitted","reviewed","published"].includes(state.rm.submission?.status)?"disabled":""}>${icon("fa-paper-plane")} Submit for review</button>`;
        const level=state.rm.class?.level||matching[0]?.level;
        const content=commentOnly?`<div class="table-wrap"><table><thead><tr><th>Learner</th><th>Class-teacher comment</th><th></th></tr></thead><tbody>${learners.map(m=>`<tr><td><strong>${esc(m.full_name)}</strong><span class="row-sub">${esc(m.reg_no||"")}</span></td><td><textarea data-comment="${esc(m.learner_id)}" maxlength="1500" aria-label="Class-teacher comment for ${esc(m.full_name)}">${esc(state.rm.comments[m.learner_id]||m.suggested_comment||"")}</textarea></td><td><button class="btn btn-quiet btn-small" data-action="save-comment" data-learner="${esc(m.learner_id)}">Choose comment</button><span data-comment-state="${esc(m.learner_id)}" role="status"></span></td></tr>`).join("")}</tbody></table></div>`:`<div class="formula-note">${esc(markEntryDescription(level,period))}</div><div class="table-wrap marks-mobile-wrap"><table id="teacher-marks-table"><thead>${markEntryTableHeaders(period,level)}</thead><tbody>${learners.map(m=>markEntryRow(m,period,level,true,isClassTeacher,state.rm.subject?.id||"")).join("")}</tbody></table></div>`;
        return `${heading(commentOnly?"Class-teacher comments":"Marks register",commentOnly?"Add comments for learners in your assigned class.":markEntryDescription(level,period),actions)}<section class="card section-card"><div class="period-bar"><div class="field"><label for="rm-level">Level</label><select id="rm-level" data-mark-entry-level>${markEntryLevelOptions(groupValue)}</select></div><div class="field"><label for="rm-class">Assigned class</label><select id="rm-class" data-rm-filter="class_id">${classOptionsMarkup}</select></div><div class="field"><label for="rm-subject">Assigned subject</label><select id="rm-subject" data-rm-filter="subject_id" ${!subjects.length?"disabled":""}>${subjectOptions}</select>${selectedSubject?.is_compulsory?'<span class="compulsory-note" role="status"><strong>* Compulsory subject</strong> — required by the school.</span>':""}</div><div class="field"><label for="rm-year">Academic year</label><input id="rm-year" type="number" min="2000" max="2100" value="${esc(state.filter.academic_year)}" data-rm-filter="academic_year"></div><div class="field"><label for="rm-term">Term</label><select id="rm-term" data-rm-filter="term">${["TERM_1","TERM_2","TERM_3"].map(t=>`<option value="${t}" ${t===state.filter.term?"selected":""}>${t.replace("_"," ")}</option>`).join("")}</select></div>${markEntryPeriodSelect("rm-assessment-period")}<button class="btn btn-quiet" data-action="load-teacher-marks">${icon("fa-arrow-right")} Load ${commentOnly?"learners":"register"}</button></div>${state.rm.submission?`<p class="submission-status"><span class="badge">${esc(state.rm.submission.status)}</span>${state.rm.submission.submitted_at?` Submitted ${esc(new Date(state.rm.submission.submitted_at).toLocaleString("en-UG"))}`:""}</p>`:""}</section>${state.rm.error?errorBox(state.rm.error,"marks"):""}<section class="card section-card"><div class="section-title"><div><h2>${esc(state.rm.class?.name||"Assessment register")}${state.rm.subject?.name?` · ${esc(state.rm.subject.name)}`:""}${state.rm.subject?.is_compulsory?' <span class="badge orange">* Compulsory</span>':""}</h2><p>${commentOnly?"Comments can be updated by the assigned class teacher.":esc(markEntryDescription(level,period))}</p></div></div>${!state.filter.class_id?empty("No assigned class","Your administrator can assign classes and subjects."):state.rm.marks===null?loading():learners.length?content:empty("No learners in this class","The assigned class has no active learners.")}</section>${signaturePanel()}`;
  }
   async function loadReviewQueue(){state.rm.review=null;state.rm.error="";state.rm.promotion=null;state.rm.promotionError="";render();try{const q=new URLSearchParams({term:state.filter.term,year:String(state.filter.academic_year)});const pending=[api(`/api/rm/review-queue?${q}`)];if(!Array.isArray(state.data.classes))pending.push(api("/api/classes").then(result=>{state.data.classes=result.classes||[]}));const [queue]=await Promise.all(pending);state.rm.review=queue.submissions||[];const classes=state.data.classes||[];if(!state.rm.promotionClassId||!classes.some(c=>String(c.id)===String(state.rm.promotionClassId)))state.rm.promotionClassId=classes[0]?.id||"";if(state.filter.term==="TERM_3"&&state.rm.promotionClassId){try{state.rm.promotion=await api(`/api/class/${encodeURIComponent(state.rm.promotionClassId)}/promotion-suggestions?${q}`)}catch(e){state.rm.promotionError=e.message}}}catch(e){state.rm.error=e.message}render()}
   function promotionText(decision,currentClass="",nextClass=""){if(decision==="promoted")return `Promoted to ${nextClass||"next class"}`;if(decision==="try_another")return "Try another class";if(decision==="repeat")return `Advised to repeat ${currentClass||"current class"}`;return "Pending"}
   function reviewPage(){
     const rows=state.rm.review||[];
     const actions=x=>`${x.status==="published"?"":`<button class="btn btn-outline btn-small" data-action="view-submission" data-id="${esc(x.id)}">View / edit</button>`}${x.status==="submitted"?`<button class="btn btn-primary btn-small" data-action="approve-submission" data-id="${esc(x.id)}">Approve</button><button class="btn btn-quiet btn-small" data-action="return-submission" data-id="${esc(x.id)}">Return</button>`:""}${x.status==="reviewed"?`<button class="btn btn-accent btn-small" data-action="publish-submission" data-id="${esc(x.id)}">Publish</button>`:""}`;
      const classes=state.data.classes||[];
      const promotionRows=state.rm.promotion?.suggestions||[];
      const promotionPanel=state.filter.term==="TERM_3"?`<section class="card section-card promotion-review-card"><div class="section-title"><div><h2>Promotion decisions</h2><p>Review Term III averages and save any decision overrides.</p></div></div><div class="period-bar"><div class="field"><label for="review-promotion-class">Class</label><select id="review-promotion-class" data-promotion-class>${classOptions(state.rm.promotionClassId)}</select></div><button class="btn btn-quiet" data-action="load-review">${icon("fa-rotate")} Load decisions</button></div>${state.rm.promotionError?`<div class="alert error" role="alert">${esc(state.rm.promotionError)}</div>`:state.rm.promotion===null?loading():promotionRows.length?`<div class="table-wrap"><table><thead><tr><th>Learner</th><th>Final average</th><th>Suggested promotion</th><th>Admin decision</th></tr></thead><tbody>${promotionRows.map(x=>{const saved=x.promotion_decision||x.suggested_decision||"pending";return `<tr data-promotion-learner="${esc(x.learner.id)}"><td><strong>${esc(x.learner.full_name)}</strong><span class="row-sub">${esc(x.learner.reg_no||"")}</span></td><td>${fmt(x.final_avg)}</td><td>${esc(promotionText(x.suggested_decision,x.current_class,x.next_class))}</td><td><select data-promotion-decision aria-label="Promotion decision for ${esc(x.learner.full_name)}"><option value="promoted" ${saved==="promoted"?"selected":""}>Promoted</option><option value="try_another" ${saved==="try_another"?"selected":""}>Try another class</option><option value="repeat" ${saved==="repeat"?"selected":""}>Advised to repeat</option><option value="pending" ${saved==="pending"?"selected":""}>Pending</option></select></td></tr>`}).join("")}</tbody></table></div><div class="page-actions"><button class="btn btn-primary" data-action="save-promotion-review">${icon("fa-floppy-disk")} Save all decisions</button></div>`:empty("No learners found","No active learners are registered in this class.")}</section>`:"";
      return `${heading("Marks review","Review submitted class and subject registers before publishing results.")}<section class="card section-card"><div class="toolbar"><label>Term<select data-rm-filter="term">${["TERM_1","TERM_2","TERM_3"].map(t=>`<option value="${t}" ${state.filter.term===t?"selected":""}>${t.replace("_"," ")}</option>`).join("")}</select></label><label>Year<input type="number" data-rm-filter="academic_year" value="${esc(state.filter.academic_year)}"></label><button class="btn btn-quiet" data-action="load-review">${icon("fa-rotate")} Refresh queue</button></div>${state.rm.error?errorBox(state.rm.error,"review"):state.rm.review===null?loading():rows.length?`<div class="table-wrap"><table><thead><tr><th>Class</th><th>Subject</th><th>Teacher</th><th>Period</th><th>Submitted</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows.map(x=>`<tr><td><strong>${esc(x.class_name||"—")}</strong></td><td>${esc(x.subject_name||"—")}</td><td>${esc(x.submitted_by_name||"—")}</td><td>${fmt(x.term||state.filter.term)} · ${fmt(x.year||state.filter.academic_year)}</td><td>${fmt(x.submitted_at?new Date(x.submitted_at).toLocaleDateString("en-UG"):"")}</td><td><span class="badge">${esc(x.status)}</span></td><td class="review-actions">${actions(x)}</td></tr>`).join("")}</tbody></table></div>`:empty("Review queue is clear","Submissions for this term will appear here.")}</section>${promotionPanel}`;
   }
   function classOptions(selected="",includeBlank=true){const arr=state.data.classes||[];return `${includeBlank?'<option value="">Choose a class</option>':""}${arr.map(c=>`<option value="${esc(c.id)}" ${String(c.id)===String(selected)?"selected":""}>${esc(c.name)}${c.stream?` · ${esc(c.stream)}`:""}</option>`).join("")}`}
   function classTeacherOptions(selected=""){return `<option value="">No class teacher</option>${(state.data.teachers||[]).filter(t=>t.teacher_type==="class_teacher").map(t=>`<option value="${esc(t.id)}" ${String(t.id)===String(selected)?"selected":""}>${esc(t.name)}</option>`).join("")}`}
  function projectClassOptions(selected=""){return `${(state.data.classes||[]).filter(c=>isALevel(c.level)).map(c=>`<option value="${esc(c.id)}" ${String(c.id)===String(selected)?"selected":""}>${esc(c.name)}${c.stream?` · ${esc(c.stream)}`:""}</option>`).join("")}`}
  function levelOptions(selected="",includeAll=false){return `${includeAll?'<option value="">All levels</option>':""}${LEVELS.map(([v,l])=>`<option value="${v}" ${selected===v?"selected":""}>${l}</option>`).join("")}`}
  function classesPage(){const data=state.data.classes;return `${heading("Classes","Organise your school by level and stream.",button("Add class","add-class","fa-plus"))}${state.data.classesError?errorBox(state.data.classesError,"classes"):""}<section class="card section-card"><div class="section-title"><div><h2>Your classes</h2><p>${data?.length??"—"} classes in this school</p></div></div>${data===null||data===undefined?loading():data.length?`<div class="table-wrap"><table><thead><tr><th>Class</th><th>Level</th><th>Stream</th><th>Average age</th><th></th></tr></thead><tbody>${data.map(c=>`<tr><td class="row-primary">${esc(c.name)}</td><td><span class="badge">${esc(levelLabel(c.level))}</span></td><td>${fmt(c.stream)}</td><td>${fmt(c.avg_age)}</td><td><div class="actions"><button class="icon-btn" aria-label="Edit ${esc(c.name)}" data-action="edit-class" data-id="${esc(c.id)}">${icon("fa-pen")}</button><button class="icon-btn delete" aria-label="Delete ${esc(c.name)}" data-action="delete-class" data-id="${esc(c.id)}">${icon("fa-trash")}</button></div></td></tr>`).join("")}</tbody></table></div>`:empty("No classes yet","Add your first class to begin registering learners.",button("Add class","add-class"))}</section>`}
   function learnersPage(){const data=state.data.learners;const action=`<button class="btn btn-outline" data-action="import-csv">${icon("fa-file-csv")} Import CSV</button>${button("Add learner","add-learner","fa-user-plus")}`;return `${heading("Learners","A clear, current register for every class.",action)}${state.data.learnersError?errorBox(state.data.learnersError,"learners"):""}<section class="card section-card"><div class="toolbar"><label class="sr-only" for="learner-search">Search learners</label><input id="learner-search" placeholder="Search name or registration no." value="${esc(state.filter.search)}" data-filter="search"><label class="sr-only" for="learner-class-filter">Filter by class</label><select id="learner-class-filter" data-filter="class_id">${classOptions(state.filter.class_id)}</select><button class="btn btn-quiet" data-action="apply-learners">${icon("fa-magnifying-glass")} Search</button></div>${data===null||data===undefined?loading():data.length?`<div class="table-wrap"><table><thead><tr><th>Learner</th><th>Reg. no.</th><th>Class</th><th>Gender</th><th>Parent / guardian</th><th></th></tr></thead><tbody>${data.map(l=>`<tr><td class="row-primary"><button class="learner-name-button" type="button" data-action="view-learner" data-id="${esc(l.id)}">${esc(l.full_name)}</button></td><td>${fmt(l.reg_no)}</td><td>${esc((state.data.classes||[]).find(c=>c.id===l.class_id)?.name||"—")}</td><td>${fmt(l.gender)}</td><td>${fmt(l.parent_name)}</td><td><div class="actions"><button class="icon-btn" aria-label="Edit ${esc(l.full_name)}" data-action="edit-learner" data-id="${esc(l.id)}">${icon("fa-pen")}</button><button class="icon-btn delete" aria-label="Delete ${esc(l.full_name)}" data-action="delete-learner" data-id="${esc(l.id)}">${icon("fa-trash")}</button></div></td></tr>`).join("")}</tbody></table></div>`:empty("No learners found","Try another search, or add a learner to this register.",button("Add learner","add-learner","fa-user-plus"))}</section><input type="file" id="csv-file" accept=".csv,text/csv" class="hidden" aria-label="Choose learner CSV file">`}
   function subjectsPanel(categoryFilter=""){
     const data=state.data.subjects;
     const rows=(data||[]).filter(s=>(!state.filter.level||s.level===state.filter.level)&&(!categoryFilter||(s.category||"CORE")===categoryFilter));
    const actions=`${categoryFilter==="OTHER"?"":`<button class="btn btn-outline" data-action="seed-subjects">${icon("fa-wand-magic-sparkles")} Add defaults</button>`}<button class="btn btn-primary" data-action="add-subject" data-category="${categoryFilter||"CORE"}">${icon("fa-plus")} ${categoryFilter==="OTHER"?"Add other subject":"Add subject"}</button>`;
     const categoryText=categoryFilter==="OTHER"?"Other subjects and co-curricular activities":"Core report-card subjects";
     return `<section class="card section-card"><div class="section-title"><div><h2>${categoryText}</h2><p>Choose where each subject appears on report cards and mark compulsory subjects for staff.</p></div><div class="page-actions">${actions}</div></div>
       <div class="toolbar"><label class="sr-only" for="subject-level">Filter subjects by level</label><select id="subject-level" data-filter="level">${levelOptions(state.filter.level,true)}</select><button class="btn btn-quiet" data-action="apply-level-subjects">Apply filter</button></div>
       ${state.data.subjectsError?errorBox(state.data.subjectsError,"subjects"):""}
       ${data===null||data===undefined?loading():rows.length?`<div class="table-wrap"><table><thead><tr><th>Subject / activity</th><th>Level</th><th>Code</th><th>Papers</th><th>Report-card section</th><th>Compulsory</th><th></th></tr></thead><tbody>${rows.map(s=>`<tr><td class="row-primary">${esc(s.name)}</td><td><span class="badge">${esc(levelLabel(s.level))}</span></td><td>${fmt(s.code)}</td><td>${fmt(s.papers)}</td><td>${(s.category||"CORE")==="OTHER"?"Other / co-curricular":"Core subject table"}</td><td>${s.is_compulsory?'<span class="badge orange">* Compulsory</span>':'<span class="field-hint">Optional</span>'}</td><td><div class="actions"><button class="icon-btn" aria-label="Edit ${esc(s.name)}" data-action="edit-subject" data-id="${esc(s.id)}">${icon("fa-pen")}</button><button class="icon-btn delete" aria-label="Delete ${esc(s.name)}" data-action="delete-subject" data-id="${esc(s.id)}">${icon("fa-trash")}</button></div></td></tr>`).join("")}</tbody></table></div>`:empty(categoryFilter==="OTHER"?"No other subjects or co-curricular activities":"No core subjects for this level",categoryFilter==="OTHER"?"Add school-specific activities here; they will appear in the report-card co-curricular section.":"Create subjects or add the standard defaults for a level.",actions)}</section>`;
   }
   function subjectsPage(){return `${heading("Subjects","Set up core subjects and co-curricular activities for each level.")}${subjectsPanel()}`}
   function gradingPanel(){
      const data=state.data.grading,level=state.filter.level||"PRIMARY",rows=(data||[]).filter(g=>g.level===level);
      const active=(state.data.activeGradingScales||[]).find(scale=>scale.level===level)||state.data.activeGradingScale;
      const scales=(state.data.gradingScales||[]).filter(scale=>scale.level===level);
      const editable=!!active?.id&&(active?.scale_type!=="preset"||active?.preset_key==="o_level_new_uce");
      const activateOptions=scales.map(scale=>`<option value="${esc(scale.id)}" ${scale.is_active?"selected":""}>${esc(scale.name)}${scale.is_active?" · active":""}</option>`).join("");
      const actions=`<button class="btn btn-outline" data-action="seed-grading">${icon("fa-wand-magic-sparkles")} Add defaults</button><button class="btn btn-outline" data-action="create-grading-scale">${icon("fa-layer-group")} New custom scale</button>${editable?button("Add grade","add-grade"):""}`;
       const presetButtons=level==="A_LEVEL"?`<div class="grading-presets"><button class="btn btn-quiet" data-action="activate-grading-preset" data-preset="a_level_legacy">Use Old A-Level (D1–F9)</button><button class="btn btn-quiet" data-action="activate-grading-preset" data-preset="a_level_uace_cbc">Use New A-Level (UACE CBC)</button></div>`:level==="PRIMARY"?`<div class="grading-presets"><button class="btn btn-quiet" data-action="activate-grading-preset" data-preset="primary_ple_upper">Use Upper Primary PLE (P.4–P.7)</button></div>`:level==="O_LEVEL"?`<div class="grading-presets"><button class="btn btn-quiet" data-action="activate-grading-preset" data-preset="o_level_old_uce">Use Old UCE (D1–F9)</button><button class="btn btn-quiet" data-action="activate-grading-preset" data-preset="o_level_new_uce">Use New UCE (A–E)</button></div>`:"";
       const subjectBandAction=level==="PRIMARY"&&active?.preset_key!=="primary_ple_upper"?`<button class="btn btn-outline" data-action="edit-primary-subject-bands" ${active?.id?"":"disabled"}>${icon("fa-sliders")} Edit subject bands</button>`:"";
      const pointsScheme=active?.preset_key==="a_level_legacy"?`<div class="grading-points-note"><strong>Legacy points are a separate step.</strong><span>Paper score produces D1–F9. Teachers enter the overall A–F grade separately. Principal: A=6, B=5, C=4, D=3, E=2, O=1, F=0.</span><span>Subsidiary: A=1, B=0.5, C=0.5, D=0.5, E=0.5, O=0, F=0.</span></div>`:active?.preset_key==="a_level_uace_cbc"?`<div class="grading-points-note"><strong>Mark composition:</strong><span>20% continuous assessment + 80% end-of-term examination.</span></div>`:active?.preset_key==="o_level_old_uce"?`<div class="grading-points-note"><strong>Old UCE:</strong><span>Annual final score = CA × 20% + Exam × 80%. Subject grades use D1–F9 points. Best 8 points determine the aggregate and Division.</span><span>Division 1: 8–32; Division 2: 33–45; Division 3: 46–58; Division 4: 59–72; Failure (U): 73+.</span></div>`:active?.preset_key==="o_level_new_uce"?`<div class="grading-points-note"><strong>New UCE:</strong><span>Annual final score = CA × 20% + Exam × 80%. Edit the A–E score bands below. Result 1 requires at least 8 subjects, a completed Project Work, no missing compulsory subject, and at least one grade from A–D.</span><span>Unchecked Project Work or an incomplete requirement results in Result 2; all E grades result in Result 3.</span></div>`:"";
      const controls=`<div class="toolbar"><label class="sr-only" for="grading-level">Filter grades by level</label><select id="grading-level" data-filter="level">${levelOptions(state.filter.level||level,true)}</select><button class="btn btn-quiet" data-action="apply-level-grading">Apply filter</button>${scales.length?`<label class="sr-only" for="active-grading-scale">Choose a saved scale</label><select id="active-grading-scale" data-grading-scale>${activateOptions}</select><button class="btn btn-outline" data-action="activate-grading-scale">${icon("fa-check")} Set active</button>`:""}</div>`;
       return `<section class="card section-card"><div class="section-title"><div><h2>Grading scales</h2><p>Keep custom scales and presets separately, then choose the active scale for each level.</p><div class="active-scale-label"><strong>Active:</strong> ${esc(active?.name||"No scale selected")}</div></div><div class="page-actions">${actions}${subjectBandAction}</div></div>${controls}${presetButtons}${active?.preset_key==="primary_ple_upper"?`<div class="formula-note">P.4–P.7 use the same official UNEB D1–F9 bands and points for English, Math, Science, and SST. P.1–P.3 keep their existing lower-primary competency grading.</div>`:""}${pointsScheme}${state.data.gradingError?errorBox(state.data.gradingError,"grading"):""}${data===null||data===undefined?loading():rows.length?`<div class="table-wrap"><table><thead><tr><th>Level</th><th>Grade</th><th>Score range</th><th>Points</th><th>Descriptor</th><th>Dropdown remark</th><th></th></tr></thead><tbody>${rows.map(g=>`<tr><td>${esc(levelLabel(g.level))}</td><td><span class="badge orange">${esc(g.grade_code)}</span></td><td>${fmt(g.min_score)} – ${fmt(g.max_score)}</td><td>${g.points===null||g.points===undefined?"—":fmt(g.points)}</td><td>${fmt(g.descriptor)}</td><td>${fmt(g.comment)}</td><td>${editable?`<div class="actions"><button class="icon-btn" aria-label="Edit grade ${esc(g.grade_code)}" data-action="edit-grade" data-id="${esc(g.id)}">${icon("fa-pen")}</button><button class="icon-btn delete" aria-label="Delete grade ${esc(g.grade_code)}" data-action="delete-grade" data-id="${esc(g.id)}">${icon("fa-trash")}</button></div>`:""}</td></tr>`).join("")}</tbody></table></div>`:empty("No grading scale configured","Create a named custom scale or add default grades for this level.",actions)}</section>`;
   }
   function gradingPage(){return `${heading("Grading scale","Define the score bands used when marks are calculated.")}${gradingPanel()}`}
  function teachersPage(){const data=state.data.teachers;return `${heading("Teachers","Manage teaching staff and their class assignments.",button("Add teacher","add-teacher","fa-user-plus"))}${state.data.teachersError?errorBox(state.data.teachersError,"teachers"):""}<section class="card section-card"><div class="section-title"><div><h2>Teaching staff</h2><p>Assignments connect teachers to a class and subject.</p></div></div>${data===null||data===undefined?loading():data.length?`<div class="table-wrap"><table><thead><tr><th>Teacher</th><th>Contact</th><th>Type</th><th>Assignments</th><th>Account</th></tr></thead><tbody>${data.map(t=>`<tr><td class="row-primary">${esc(t.name)}</td><td>${fmt(t.email)}<div class="row-sub">${fmt(t.phone)}</div></td><td><span class="badge">${fmt(t.teacher_type||"Teacher")}</span></td><td>${(t.assignments||[]).length? (t.assignments||[]).map(a=>`<div class="row-sub">${esc(a.class_name)} · ${esc(a.subject_name)} <button class="text-button" aria-label="Remove assignment" data-action="remove-assignment" data-id="${esc(t.id)}" data-assignment="${esc(a.id)}">${icon("fa-xmark")}</button></div>`).join(""):"No assignments"}<button class="text-button" data-action="assign-teacher" data-id="${esc(t.id)}">+ Assign</button></td><td><div class="actions"><button class="icon-btn" aria-label="Edit ${esc(t.name)}" data-action="edit-teacher" data-id="${esc(t.id)}">${icon("fa-pen")}</button><button class="btn btn-quiet btn-small" data-action="reset-teacher-password" data-id="${esc(t.id)}">Reset password</button></div></td></tr>`).join("")}</tbody></table></div>`:empty("No teachers added","Add a staff member, then assign their classes and subjects.",button("Add teacher","add-teacher","fa-user-plus"))}</section>`}
   function currentScale(teacher=false){return teacher?state.rm.activeGradingScale:state.data.activeGradingScale}
   function legacyALevel(teacher=false){return currentScale(teacher)?.preset_key==="a_level_legacy"}
    function pointsForMark(level,grade,overallGrade,pointType,teacher=false,subjectId=""){
     const scale=currentScale(teacher);if(!scale)return null;
     if(scale.preset_key==="a_level_legacy"){
       const points=scale.points_scheme?.[pointType||""]?.[String(overallGrade||"").toUpperCase()];
       return Number.isFinite(Number(points))?Number(points):null;
     }
      const subjectRows=teacher?(state.rm.subjectGradeScales||[]):(state.data.subjectGrading||[]);
      const subjectRow=subjectRows.find(item=>String(item.subject_id)===String(subjectId)&&item.grade_code===grade);
      if(subjectRow?.points!==null&&subjectRow?.points!==undefined&&subjectRow?.points!=="")return Number(subjectRow.points);
      const rows=teacher?(state.rm.gradeScales||[]):(state.data.grading||[]);
     const row=rows.find(item=>item.level===level&&item.grade_code===grade);
     return row?.points===null||row?.points===undefined||row?.points===""?null:Number(row.points);
   }
    function gradeCellMarkup(mark,level,teacher=false,subjectId=mark.subject_id||""){
     const grade=mark.grade||mark.grade_code||"";
     const oldLevel=level==="A_LEVEL"&&legacyALevel(teacher);
     const overall=mark.overall_grade_code||"";
     const type=mark.grade_point_type||"principal";
      const points=pointsForMark(level,grade,overall,type,teacher,subjectId);
     const label=oldLevel
       ? [grade,overall&&`${overall}${points!==null?` · ${points} pts`:""}`].filter(Boolean).join(" · ")
       : `${grade||"—"}${points!==null?` · ${points} pts`:""}`;
     return `<span class="badge" data-grade-label>${esc(label||"—")}</span>${oldLevel?`<div class="alevel-overall-grade"><label class="sr-only" for="overall-${esc(mark.learner_id)}">Overall A–F grade</label><select id="overall-${esc(mark.learner_id)}" data-overall-grade aria-label="${esc(mark.full_name)} overall grade"><option value="">Overall grade</option>${["A","B","C","D","E","O","F"].map(code=>`<option value="${code}" ${overall===code?"selected":""}>${code}</option>`).join("")}</select><label class="grade-point-type"><input type="checkbox" data-grade-point-type ${type==="subsidiary"?"checked":""}> Subsidiary</label></div>`:""}`;
   }
     function subjectRemarkCell(mark,teacher=false,subjectId=mark.subject_id||""){
      const level=teacher?state.rm.class?.level:(state.data.classes||[]).find(item=>String(item.id)===String(state.filter.class_id))?.level;
      const gradeRows=teacher?state.rm.gradeScales||[]:state.data.grading||[];
      const configured=gradeRows.filter(row=>!level||row.level===level).map(row=>String(row.comment||"").trim()).filter(Boolean);
      const options=[...new Set([...(teacher?state.rm.commentOptions||[]:state.data.commentOptions||[]),...configured,"Excellent performance in this subject.","Very good performance in this subject.","Satisfactory performance in this subject.","Needs improvement in this subject.","Needs additional support in this subject."])];
     const mode=["auto","dropdown","custom"].includes(mark.tr_mode)?mark.tr_mode:mark.tr?"custom":"auto";
     const value=mode==="auto"?"":typeof mark.tr==="string"?mark.tr:"";
     const prefix=`${esc(mark.learner_id)}-remark`;
      const subjectName=subjectNameForUi(teacher,subjectId);
      return `<td class="subject-remark-cell"><label class="sr-only" for="${prefix}-mode">${esc(mark.full_name)} subject remark mode</label><select id="${prefix}-mode" data-tr-mode><option value="auto" ${mode==="auto"?"selected":""}>Auto</option><option value="dropdown" ${mode==="dropdown"?"selected":""}>Dropdown</option><option value="custom" ${mode==="custom"?"selected":""}>Custom</option></select><div class="subject-remark-auto" data-tr-panel="auto" ${mode!=="auto"?"hidden":""}>${esc(mode==="auto"?(value||subjectRemarkForUi(mark.grade||mark.grade_code,subjectName)||"Generated from grade"):"")}</div><select class="mark-input mark-remark-input" data-teacher-remark data-tr-input="dropdown" aria-label="${esc(mark.full_name)} saved subject remark" ${mode!=="dropdown"?"hidden":""}><option value="">Choose a remark</option>${options.map(option=>`<option value="${esc(option)}" ${value===option?"selected":""}>${esc(option)}</option>`).join("")}</select><textarea class="mark-input mark-remark-input" data-teacher-remark data-tr-input="custom" maxlength="500" aria-label="${esc(mark.full_name)} custom subject remark" ${mode!=="custom"?"hidden":""}>${esc(value)}</textarea></td>`;
   }
    function subjectNameForUi(teacher=false,subjectId=""){
      const subject=teacher?state.rm.subject:(state.data.subjects||[]).find(item=>String(item.id)===String(subjectId));
      return String(subject?.name||"this subject").trim();
    }
    function subjectRemarkForUi(grade,subjectName="this subject"){
     const code=String(grade||"").toUpperCase();
      const subject=String(subjectName||"this subject").trim()||"this subject";
      if(["A","D1","D2","3","2A"].includes(code))return `Excellent performance in ${subject}.`;
      if(["B","C3","C4","C5","C6"].includes(code))return `Very good performance in ${subject}.`;
      if(["C","2","2B","P7"].includes(code))return `Satisfactory performance in ${subject}.`;
      if(["D","1A","P8"].includes(code))return `Needs improvement in ${subject}.`;
      if(["E","F","F9","1B"].includes(code))return `Needs additional support in ${subject}.`;
     return "";
   }
    function markEntryPeriod(value=state.filter.assessment_period){
      return MARK_ENTRY_PERIODS.find(period=>period.value===value)||MARK_ENTRY_PERIODS.find(period=>period.value==="EOT");
    }
    function markEntryPeriodSelect(id="marks-assessment-period"){
      const selected=markEntryPeriod().value;
      return `<div class="field"><label for="${id}">Assessment period</label><select id="${id}" data-mark-period aria-label="Assessment period">${MARK_ENTRY_PERIODS.map(period=>`<option value="${period.value}" ${period.value===selected?"selected":""}>${esc(period.label)}</option>`).join("")}</select></div>`;
    }
    function markEntryDescription(level,period=markEntryPeriod()){
      const levelText=level?levelLabel(level):"class";
      const fieldNames=period.fields.map(field=>field.label).join(", ");
      return `${levelText} · ${period.title}: enter ${fieldNames} scores from 0 to 100. Other assessment periods are left unchanged.`;
    }
    function markEntryTableHeaders(period,level){
      return `<tr><th>Learner</th>${period.fields.map(field=>`<th>${esc(field.label)} / 100</th>`).join("")}${level==="A_LEVEL"?"<th>Paper</th>":""}<th>Teacher initials</th><th>Grade</th><th>Teacher’s remarks</th></tr>`;
    }
    function markEntryRow(m,period,level,teacher=false,isClassTeacher=false,subjectId=""){
      const displayMark={...m,grade:m.grade||m.grade_code||""};
      const periodCells=period.fields.map(field=>`<td><input class="mark-input" type="number" min="0" max="100" step="0.01" value="${m[field.key]??""}" data-mark-period-score="${field.key}" aria-label="${esc(m.full_name)} ${esc(field.label)} score"></td>`).join("");
      const paperCell=level==="A_LEVEL"?`<td><input class="mark-input" type="number" min="1" max="20" step="1" value="${m.paper_number??""}" data-score="paper_number" aria-label="${esc(m.full_name)} paper number"></td>`:"";
      const ancillary=`${paperCell}<td><input class="mark-input initials-input" maxlength="30" value="${esc(m.teacher_initials||"")}" data-initials aria-label="${esc(m.full_name)} teacher initials"></td><td data-result="grade">${gradeCellMarkup(displayMark,level,teacher,subjectId)}</td>${subjectRemarkCell(displayMark,teacher,subjectId)}`;
      const comment=isClassTeacher?`<tr class="comment-row"><td colspan="${1+period.fields.length+(level==="A_LEVEL"?1:0)+3}"><label for="comment-${esc(m.learner_id)}">Class-teacher comment · ${esc(m.full_name)}</label><textarea id="comment-${esc(m.learner_id)}" data-comment="${esc(m.learner_id)}" maxlength="1500">${esc(m.class_teacher_comment||m.suggested_comment||"")}</textarea><button class="btn btn-quiet btn-small" data-action="save-comment" data-learner="${esc(m.learner_id)}">${icon("fa-comment")} Choose comment</button><span data-comment-state="${esc(m.learner_id)}" role="status"></span></td></tr>`:"";
      return `<tr data-learner="${esc(m.learner_id)}"><td><strong>${esc(m.full_name)}</strong><span class="row-sub">${esc(m.reg_no||"")}</span></td>${periodCells}${ancillary}</tr>${comment}`;
    }
  function marksPage(){
    const marks=state.data.marks,classes=state.data.classes||[],subjects=state.data.subjects||[];
    const groupValue=markEntryLevelForClass(classes,state.filter.class_id,state.filter.mark_entry_level);
    const classRows=markClassesForLevel(classes,groupValue);
    const selectedClass=classRows.find(c=>String(c.id)===String(state.filter.class_id));
    const level=selectedClass?.level,options=markSubjectsForLevel(subjects,groupValue);
    const selectedSubject=options.find(s=>String(s.id)===String(state.filter.subject_id));
    const canLoad=!!selectedClass&&markClassGroup(selectedClass)===groupValue&&!!selectedSubject;
    const period=markEntryPeriod();
    const legacy=marks?.some(m=>(m.ca1_score!=null||m.ca2_score!=null||m.exam_score!=null)&&m.a1==null&&m.a2==null&&m.a3==null&&m.eot==null);
    return `${heading("Marks",markEntryDescription(level,period),`<button class="btn btn-quiet" data-action="save-marks" ${!canLoad||!marks?.length||state.data.savingMarks?"disabled":""}>${icon("fa-floppy-disk")} ${state.data.savingMarks?"Saving…":"Save marks"}</button>`)}
      <section class="card section-card"><div class="period-bar">
        <div class="field"><label for="marks-level">Level</label><select id="marks-level" data-mark-entry-level>${markEntryLevelOptions(groupValue)}</select></div>
        <div class="field"><label for="marks-class">Class</label><select id="marks-class" data-filter="class_id">${markEntryClassOptions(classRows,state.filter.class_id,groupValue)}</select></div>
         <div class="field"><label for="marks-subject">Subject</label><select id="marks-subject" data-filter="subject_id"><option value="">Choose a subject</option>${options.map(s=>`<option value="${esc(s.id)}" ${String(s.id)===String(state.filter.subject_id)?"selected":""}>${esc(s.name)}${s.is_compulsory?" *":""}${s.category==="OTHER"?" · Other":""}</option>`).join("")}</select>${selectedSubject?.is_compulsory?'<span class="compulsory-note" role="status"><strong>* Compulsory subject</strong> — this subject is required by the school.</span>':""}</div>
        <div class="field"><label for="marks-year">Academic year</label><input id="marks-year" type="number" min="2000" max="2100" value="${esc(state.filter.academic_year)}" data-filter="academic_year"></div>
        <div class="field"><label for="marks-term">Term</label><select id="marks-term" data-filter="term">${["TERM_1","TERM_2","TERM_3"].map(t=>`<option value="${t}" ${state.filter.term===t?"selected":""}>${t.replace("_"," ")}</option>`).join("")}</select></div>
        ${markEntryPeriodSelect()}
        <button class="btn btn-primary" data-action="load-marks">${icon("fa-arrow-right")} Load register</button>
      </div></section>${state.data.marksError?errorBox(state.data.marksError,"marks"):""}
      <section class="card section-card marks-register-panel"><div class="section-title"><div><h2>Assessment register · ${esc(period.title)}${selectedSubject?.is_compulsory?' <span class="badge orange">* Compulsory</span>':""}</h2><p>${esc(markEntryDescription(level,period))}</p></div><button class="btn btn-outline" data-action="toggle-mark-fullscreen">${icon("fa-expand")} Full screen</button></div>
      ${!canLoad?empty("Choose a class and subject","Select the assessment period and load the register."):marks===null||marks===undefined?loading():marks.length?`${legacy?'<div class="formula-note" style="margin-bottom:15px">Older RC-2 CA1/CA2/exam marks are preserved separately. New CBC entries do not overwrite them.</div>':""}
        <div class="table-wrap marks-mobile-wrap"><table id="marks-table"><thead>${markEntryTableHeaders(period,level)}</thead><tbody>${marks.map(m=>markEntryRow({...m,grade:m.grade_code},period,level,false,false,state.filter.subject_id)).join("")}</tbody></table></div>`:empty("No learners in this class","Add active learners to the selected class before entering marks.")}</section>`;
  }
  function reportsPage(){
     const classes=state.data.classes||[],reports=reportState.data?.learners||[],learners=reportState.learners||reports.map(r=>r.learner);
    const selected=reports.find(r=>String(r.learner.id)===String(reportState.learnerId));
    const level=reportState.data?.class?.level||classes.find(c=>String(c.id)===String(reportState.classId))?.level||"NURSERY";
     const promotion=selected?.promotion||null;
     const promotionPanel=reportState.term==="TERM_3"&&selected&&state.role==="school_admin"?`<section class="card section-card promotion-decision-card"><div class="section-title"><div><h2>Promotion decision</h2><p>Term III recommendation based on the learner’s final average.</p></div></div>${reportState.promotionError?`<div class="alert error" role="alert">${esc(reportState.promotionError)}</div>`:""}<div class="promotion-decision-summary"><span><strong>Final average</strong> ${fmt(promotion?.final_avg)}</span><span><strong>Suggested</strong> ${esc(promotionText(promotion?.suggested_decision,promotion?.current_class,promotion?.next_class))}</span></div><div class="promotion-edit-row"><div class="field"><label for="report-promotion-decision">Admin decision</label><select id="report-promotion-decision" data-promotion-decision><option value="promoted" ${(promotion?.promotion_decision||promotion?.suggested_decision)==="promoted"?"selected":""}>Promoted</option><option value="try_another" ${(promotion?.promotion_decision||promotion?.suggested_decision)==="try_another"?"selected":""}>Try another class</option><option value="repeat" ${(promotion?.promotion_decision||promotion?.suggested_decision)==="repeat"?"selected":""}>Advised to repeat</option><option value="pending" ${(promotion?.promotion_decision||promotion?.suggested_decision)==="pending"?"selected":""}>Pending</option></select></div><div class="field"><label for="report-promotion-note">Decision note <span class="field-hint">(optional)</span></label><input id="report-promotion-note" maxlength="2000" value="${esc(promotion?.promotion_note||"")}" placeholder="Add a note for the learner’s record"></div><button class="btn btn-primary" data-action="save-report-promotion" ${reportState.promotionBusy?"disabled":""}>${icon("fa-floppy-disk")} ${reportState.promotionBusy?"Saving…":"Save decision"}</button></div></section>`:"";
    const ages=reports.map(item=>Number(item.learner?.age)).filter(age=>Number.isFinite(age)&&age>0);
    const classAverageAge=ages.length?ages.reduce((sum,age)=>sum+age,0)/ages.length:null;
     const previewReport=selected?{...selected,school:reportState.data.school,class:reportState.data.class,term:reportState.data.term,year:reportState.data.year,period:reportState.period,layout_format:reportState.layoutFormat,term_dates:reportState.data.term_dates,level_theme:reportState.data.level_theme,stamp_config:reportState.data.stamp_config,class_average_age:classAverageAge,authenticity_qr_data_url:reportState.verifications[String(selected.learner?.id)]?.qrDataUrl}:null;
    const cardMarkup=previewReport&&window.ReportCardPreview?window.ReportCardPreview.render(previewReport,{template:reportState.template,period:reportState.period,includeStamp:reportState.includeStamp,layoutFormat:reportState.layoutFormat}):"";
    const previewToolbar=(fullscreen=false)=>`<div class="rc-viewer-controls" role="toolbar" aria-label="Report card preview controls">
      <div class="rc-viewer-zoom"><button class="btn btn-outline btn-small" data-action="preview-zoom-out" aria-label="Zoom out">−</button><span data-preview-zoom-label>${reportState.zoom}%</span><button class="btn btn-outline btn-small" data-action="preview-zoom-in" aria-label="Zoom in">+</button></div>
      ${fullscreen?`<button class="btn btn-outline btn-small" data-action="preview-close-fullscreen">${icon("fa-xmark")} Close</button>`:`<button class="btn btn-outline btn-small" data-action="preview-fullscreen">${icon("fa-expand")} Full screen</button>`}
      <button class="btn btn-outline btn-small" data-action="print-report-learner" ${reportState.verificationBusy?"disabled":""}>${icon("fa-print")} Print this learner</button>
      <button class="btn btn-outline btn-small" data-action="print-report-class" ${reportState.verificationBusy?"disabled":""}>${icon("fa-print")} Print whole class</button>
      <button class="btn btn-outline btn-small" data-action="download-report-pdf" ${reportState.verificationBusy?"disabled":""}>${icon("fa-file-pdf")} Download PDF</button>
      <button class="btn btn-primary btn-small" data-action="download-report-image" ${reportState.verificationBusy?"disabled":""}>${icon("fa-image")} Download as image</button>
    </div>`;
    const previewStage=(fullscreen=false)=>`<div class="rc-preview-stage ${fullscreen?"is-fullscreen-stage":""}"><div class="rc-preview-paper-box"><div class="rc-preview-paper" data-layout-format="${reportState.layoutFormat}">${cardMarkup}</div></div></div>`;
    const preview=cardMarkup?`<div class="rc-preview-viewer">
      ${previewToolbar(false)}${previewStage(false)}
      ${reportState.fullscreen?`<div class="rc-preview-fullscreen" role="dialog" aria-modal="true" aria-label="Full-screen report card preview"><div class="rc-preview-fullscreen-panel">${previewToolbar(true)}${previewStage(true)}</div></div>`:""}
    </div>`:"";
    const templatePicker=window.ReportCardTemplatePicker?window.ReportCardTemplatePicker.render({level,template:reportState.template,period:reportState.period,layoutFormat:reportState.layoutFormat,includeStamp:reportState.includeStamp}):"";
     const actions=`<button class="btn btn-outline" data-action="download-class-zip" ${!reports.length||reportState.busy||reportState.verificationBusy?"disabled":""}>${icon("fa-file-zipper")} Download class ZIP</button><button class="btn btn-primary" data-action="download-report-pdf" ${!selected||reportState.busy||reportState.verificationBusy?"disabled":""}>${icon("fa-file-pdf")} Download PDF</button>`;
    const canManageProjects=state.role==="school_admin";
    const projects=selected?.projects||[];
    const projectPanel=selected&&isALevel(reportState.data?.class?.level)&&canManageProjects?`
      <section class="card section-card"><div class="section-title"><div><h2>A-Level projects</h2><p>Project scores are graded automatically and appear on report cards.</p></div><button class="btn btn-primary" data-action="add-project">${icon("fa-plus")} Add project</button></div>
      ${projects.length?`<div class="table-wrap"><table><thead><tr><th>Project</th><th>Score</th><th>Out of</th><th>Grade</th><th>Remarks</th><th>Teacher initials</th><th></th></tr></thead><tbody>${projects.map(project=>`<tr><td class="row-primary">${esc(project.project_name)}</td><td>${fmt(project.score)}</td><td>${fmt(project.out_of)}</td><td>${fmt(project.grade)}</td><td>${fmt(project.remarks)}</td><td>${fmt(project.teacher_initials)}</td><td><div class="actions"><button class="icon-btn" aria-label="Edit ${esc(project.project_name)}" data-action="edit-project" data-id="${esc(project.id)}">${icon("fa-pen")}</button><button class="icon-btn delete" aria-label="Delete ${esc(project.project_name)}" data-action="delete-project" data-id="${esc(project.id)}">${icon("fa-trash")}</button></div></td></tr>`).join("")}</tbody></table></div>`:empty("No projects recorded","Add this learner's first project for the selected term.",button("Add project","add-project"))}</section>`:"";
    return `${heading("Report cards","Preview and download CBC report cards for a learner or the whole class.",actions)}
      <section class="card section-card"><div class="rc-tabs"><span class="rc-tab active">${icon("fa-eye")} Preview</span></div>
      <div class="period-bar report-filters"><div class="field"><label for="report-class">Class</label><select id="report-class" data-report-filter="classId">${classOptions(reportState.classId)}</select></div>
       <div class="field"><label for="report-learner">Learner</label><select id="report-learner" data-report-filter="learnerId" ${reportState.rosterBusy||!learners.length?"disabled":""}><option value="">${reportState.rosterBusy?"Loading learners…":learners.length?"Choose a learner":"No learners found for this class"}</option>${learners.map(learner=>`<option value="${esc(learner.id)}" ${String(learner.id)===String(reportState.learnerId)?"selected":""}>${esc(learner.full_name)} · ${esc(learner.reg_no||"")}</option>`).join("")}</select></div>
      <div class="field"><label for="report-year">Year</label><input id="report-year" type="number" min="2000" max="2100" value="${esc(reportState.year)}" data-report-filter="year"></div>
      <div class="field"><label for="report-term">Term</label><select id="report-term" data-report-filter="term">${["TERM_1","TERM_2","TERM_3"].map(t=>`<option value="${t}" ${reportState.term===t?"selected":""}>${t.replace("_"," ")}</option>`).join("")}</select></div>
       <button class="btn btn-primary" data-action="load-report-class" ${reportState.busy||!classes.length?"disabled":""}>${icon("fa-eye")} Load preview</button></div>
       ${templatePicker}
        ${reportState.error?`<div class="alert error" role="alert">${esc(reportState.error)}</div>`:""}${reportState.rosterError?`<div class="alert error" role="alert">${esc(reportState.rosterError)}</div>`:""}${reportState.verificationError?`<div class="alert error" role="alert">${esc(reportState.verificationError)} <button class="text-button" type="button" data-action="retry-report-verification">Retry</button></div>`:""}${reportState.verificationBusy?'<div class="alert info" role="status">Preparing the authenticity QR code…</div>':""}${reportState.busy?loading():""}
       ${!classes.length?empty("No classes yet","Create a class and add learners before generating report cards."):!reportState.data?`<div class="report-empty"><strong>Choose a class and assessment period.</strong><span>The preview uses saved marks, fees, school details, and term dates for that period.</span></div>`:!learners.length?empty("No active learners in this class","Add an active learner to this class before generating report cards."):!reportState.learnerId?empty("Choose a learner","Select a learner to preview their report card."):!selected?empty("Report data unavailable","This learner is in the class register, but report-card details were not returned. Reload the preview."):preview}</section>${promotionPanel}${projectPanel}`;
  }

  function projectsPage(){
    const classes=(state.data.classes||[]).filter(c=>isALevel(c.level));
    const data=state.data.projectRegister;
    const learners=data?.learners||[];
    const learnerById=new Map(learners.map(learner=>[String(learner.id),learner]));
    const projects=data?.projects||[];
    const table=projects.length?`<div class="table-wrap"><table><thead><tr><th>Learner</th><th>Project</th><th>Score</th><th>Out of</th><th>Grade</th><th>Remarks</th><th>Teacher initials</th><th></th></tr></thead><tbody>${projects.map(project=>{const learner=learnerById.get(String(project.learner_id));return `<tr><td><div class="row-primary">${esc(learner?.full_name||"Learner")}</div><div class="row-sub">${esc(learner?.reg_no||"")}</div></td><td>${esc(project.project_name)}</td><td>${fmt(project.score)}</td><td>${fmt(project.out_of)}</td><td>${fmt(project.grade)}</td><td>${fmt(project.remarks)}</td><td>${fmt(project.teacher_initials)}</td><td><div class="actions"><button class="icon-btn" aria-label="Edit ${esc(project.project_name)}" data-action="edit-project" data-id="${esc(project.id)}">${icon("fa-pen")}</button><button class="icon-btn delete" aria-label="Delete ${esc(project.project_name)}" data-action="delete-project" data-id="${esc(project.id)}">${icon("fa-trash")}</button></div></td></tr>`}).join("")}</tbody></table></div>`:empty("No projects recorded","Add a project for a learner in this class.",learners.length?button("Add project","add-project"): "");
    const actions=`<button class="btn btn-primary" data-action="add-project" ${!learners.length||!data?"disabled":""}>${icon("fa-plus")} Add project</button>`;
    return `${heading("A-Level projects","Record and maintain learner project scores for an assessment period.",actions)}
      <section class="card section-card"><div class="period-bar">
      <div class="field"><label for="project-class">A-Level class</label><select id="project-class" data-project-filter="classId"><option value="">Choose a class</option>${projectClassOptions(projectState.classId)}</select></div>
      <div class="field"><label for="project-year">Academic year</label><input id="project-year" type="number" min="1900" max="2100" value="${esc(projectState.year)}" data-project-filter="year"></div>
      <div class="field"><label for="project-term">Term</label><select id="project-term" data-project-filter="term">${["TERM_1","TERM_2","TERM_3"].map(t=>`<option value="${t}" ${projectState.term===t?"selected":""}>${t.replace("_"," ")}</option>`).join("")}</select></div>
      <button class="btn btn-primary" data-action="load-project-register" ${projectState.busy||!classes.length?"disabled":""}>${icon("fa-arrow-right")} Load projects</button></div>
      ${projectState.error?`<div class="alert error" role="alert">${esc(projectState.error)}</div>`:""}
      ${projectState.busy?loading():!classes.length?empty("No A-Level classes","Create an A-Level class and register learners first."):!projectState.classId?empty("Choose a class","Select an A-Level class and assessment period."):data?table:`<div class="report-empty"><strong>Load the selected class projects.</strong><span>Project records are grouped by learner and term.</span></div>`}</section>`;
  }

  function brandingSettingsMarkup(school){
    const rawOpacity=school.watermark_opacity===null||school.watermark_opacity===undefined||school.watermark_opacity===""?5:Number(school.watermark_opacity);
    const opacity=Number.isInteger(rawOpacity)&&rawOpacity>=0&&rawOpacity<=100?rawOpacity:5;
    const logo=schoolLogoSource(school.logo_base64);
    return `<section class="card section-card"><div class="section-title"><div><h2>School branding and report-card watermark</h2><p>Use your school logo in the dashboard and, optionally, behind report-card content.</p></div></div>
      <form id="branding-settings-form" class="form-grid" novalidate><div class="school-branding-settings">
        <div class="field"><label for="school-logo-file">School logo</label><div class="school-logo-preview-wrap">${logo?`<img class="school-logo-preview" src="${esc(logo)}" alt="${esc(school.name||"School")} logo">`:`<span class="school-logo-empty">No school logo uploaded</span>`}</div><input id="school-logo-file" name="school_logo_file" type="file" accept="image/png,image/jpeg"><span class="field-hint">PNG or JPG; maximum 2.75 MB.</span></div>
        <div class="field"><label class="watermark-toggle" for="settings-watermark-enabled"><input id="settings-watermark-enabled" name="watermark_enabled" type="checkbox" ${school.watermark_enabled===true?"checked":""}><span><strong>Report card watermark</strong><small>Show the school logo centered behind the report text and tables.</small></span></label><label for="settings-watermark-opacity">Watermark opacity <output id="watermark-opacity-value">${opacity}%</output></label><input id="settings-watermark-opacity" name="watermark_opacity" type="range" min="0" max="100" step="1" value="${opacity}" data-watermark-opacity><span class="field-hint">0% is invisible; 100% is fully opaque. Default: 5%.</span></div>
      </div><div id="branding-settings-error">${state.data.brandingError?`<div class="alert error" role="alert">${esc(state.data.brandingError)}</div>`:""}</div><div class="page-actions"><button class="btn btn-primary" type="submit" ${state.data.savingBranding?"disabled":""}>${icon("fa-floppy-disk")}${state.data.savingBranding?"Saving…":"Save branding settings"}</button></div></form></section>`;
  }
  function schoolProfileSettingsMarkup(school){
    return `<section class="card section-card"><div class="section-title"><div><h2>School profile</h2><p>These details appear in the report-card header. The school email is also used for school sign-in.</p></div></div>
      <form id="school-profile-form" class="form-grid" novalidate><div class="form-two">
        <div class="field"><label for="school-profile-name">School name *</label><input id="school-profile-name" name="name" required maxlength="200" value="${esc(school.name||"")}"></div>
        <div class="field"><label for="school-profile-motto">Motto</label><input id="school-profile-motto" name="motto" maxlength="500" value="${esc(school.motto||"")}"></div>
        <div class="field"><label for="school-profile-street">Address / street</label><input id="school-profile-street" name="street" maxlength="300" value="${esc(school.street||"")}"></div>
        <div class="field"><label for="school-profile-po-box">P.O. Box</label><input id="school-profile-po-box" name="po_box" maxlength="100" value="${esc(school.po_box||"")}"></div>
        <div class="field"><label for="school-profile-city">Town / city</label><input id="school-profile-city" name="city" maxlength="120" value="${esc(school.city||"")}"></div>
        <div class="field"><label for="school-profile-district">District</label><input id="school-profile-district" name="district" maxlength="120" value="${esc(school.district||"")}"></div>
        <div class="field"><label for="school-profile-phone">Phone</label><input id="school-profile-phone" name="phone" type="tel" maxlength="60" value="${esc(school.phone||"")}"></div>
        <div class="field"><label for="school-profile-email">School and sign-in email *</label><input id="school-profile-email" name="email" type="email" required maxlength="254" value="${esc(school.email||"")}"></div>
        <div class="field"><label for="school-profile-website">Website</label><input id="school-profile-website" name="website" inputmode="url" maxlength="500" value="${esc(school.website||"")}"></div>
        <div class="field"><label for="school-admission-number-mode">Admission number format</label><select id="school-admission-number-mode" name="admission_number_mode"><option value="manual" ${school.admission_number_mode!=="auto"?"selected":""}>Manual entry</option><option value="auto" ${school.admission_number_mode==="auto"?"selected":""}>Auto-generate sequentially</option></select><span class="field-hint">Automatic numbers continue after the highest existing numeric admission number.</span></div>
      </div><div id="school-profile-error">${state.data.schoolProfileError?`<div class="alert error" role="alert">${esc(state.data.schoolProfileError)}</div>`:""}</div><div class="page-actions"><button class="btn btn-primary" type="submit" ${state.data.savingSchoolProfile?"disabled":""}>${icon("fa-floppy-disk")}${state.data.savingSchoolProfile?"Saving…":"Save school profile"}</button></div></form></section>`;
  }
  function themeSettingsMarkup(school){
    return `<section class="card section-card"><div class="section-title"><div><h2>Report-card theme</h2><p>Set the main colors used for headers, tables, text, and page backgrounds across report-card templates.</p></div></div>
      <form id="school-theme-form" class="form-grid" novalidate><div class="form-two">
        <div class="field"><label for="school-theme-primary">Primary color</label><input id="school-theme-primary" name="report_primary_color" type="color" value="${esc(school.report_primary_color||"#4B2E9E")}"><span class="field-hint">Used for report headers, table headings, accents, and borders.</span></div>
        <div class="field"><label for="school-theme-font">Font color</label><input id="school-theme-font" name="report_font_color" type="color" value="${esc(school.report_font_color||"#292633")}"><span class="field-hint">Used for report text and table content.</span></div>
        <div class="field"><label for="school-theme-background">Background color</label><input id="school-theme-background" name="report_background_color" type="color" value="${esc(school.report_background_color||"#FFFFFF")}"><span class="field-hint">Used for the report page and shaded table rows.</span></div>
      </div><div id="school-theme-error">${state.data.schoolThemeError?`<div class="alert error" role="alert">${esc(state.data.schoolThemeError)}</div>`:""}</div><div class="page-actions"><button class="btn btn-primary" type="submit" ${state.data.savingSchoolTheme?"disabled":""}>${icon("fa-floppy-disk")}${state.data.savingSchoolTheme?"Saving…":"Save theme"}</button></div></form></section>`;
  }
   function generalSettingsMarkup(school,promotion,stampMarkup){
      return `${schoolProfileSettingsMarkup(school)}${state.data.settingsError?errorBox(state.data.settingsError,"settings"):""}
       <section class="card section-card"><div class="section-title"><div><h2>Term dates and next-term fees</h2><p>These details are included on report-card previews and PDFs.</p></div></div>
       <form id="settings-form" class="form-grid" novalidate><div class="form-two">
         <div class="field"><label for="settings-mark-entry-mode">Mark Entry Mode *</label><select id="settings-mark-entry-mode" name="mark_entry_mode" required><option value="CBC" ${school.mark_entry_mode!=="RAW"?"selected":""}>CBC Mode</option><option value="RAW" ${school.mark_entry_mode==="RAW"?"selected":""}>Raw Marks Mode</option></select><span class="field-hint">CBC shows A1, A2, A3 and EOT. Raw mode shows one marks column; Nursery and P.1–P.3 use marks out of 3, other classes use marks out of 100.</span></div>
         <div class="field"><label for="settings-current-term">Current term *</label><select id="settings-current-term" name="current_term" required>${["TERM_1","TERM_2","TERM_3"].map(t=>`<option value="${t}" ${school.current_term===t?"selected":""}>${t.replace("_"," ")}</option>`).join("")}</select></div>
         <div class="field"><label for="settings-current-year">Current year *</label><input id="settings-current-year" name="current_year" type="number" min="1900" max="2100" step="1" required value="${esc(school.current_year??new Date().getFullYear())}"></div>
         <div class="field"><label for="settings-term-ended">Term end date</label><input id="settings-term-ended" name="term_ended_on" type="date" value="${esc(String(school.term_ended_on||"").slice(0,10))}"></div>
         <div class="field"><label for="settings-next-term">Next term start date</label><input id="settings-next-term" name="next_term_begins" type="date" value="${esc(String(school.next_term_begins||"").slice(0,10))}"></div>
          <div class="field"><label for="settings-next-fees">Next-term fees</label><input id="settings-next-fees" name="next_term_fees" type="number" min="0" max="1000000000" step="0.01" value="${esc(school.next_term_fees??"")}" placeholder="e.g. 250000"></div>
          <div class="field"><label class="watermark-toggle" for="settings-show-position"><input id="settings-show-position" name="show_report_position" type="checkbox" ${school.show_report_position!==false?"checked":""}><span><strong>Show class position on report cards</strong><small>Turn this off to use the alternative format without position; average and grade remain visible.</small></span></label></div>
           <div class="field"><label for="settings-primary-result-metric">Primary report-card result</label><select id="settings-primary-result-metric" name="primary_result_metric"><option value="average" ${school.primary_result_metric!=="ple_aggregate"?"selected":""}>Use Average</option><option value="ple_aggregate" ${school.primary_result_metric==="ple_aggregate"?"selected":""}>Use PLE Aggregate</option></select><span class="field-hint">PLE Aggregate adds the best four core-subject points and is used when the Upper Primary PLE scale is active.</span></div>
       </div><div id="settings-error"></div><div class="page-actions"><button class="btn btn-primary" type="submit" ${state.data.savingSettings?"disabled":""}>${icon("fa-floppy-disk")}${state.data.savingSettings?"Saving…":"Save school settings"}</button></div></form></section>
       <section class="card section-card"><div class="section-title"><div><h2>Promotion Rules</h2><p>Set the Term III final-average thresholds used for promotion suggestions.</p></div></div>
       <form id="promotion-rules-form" class="form-grid" novalidate><div class="form-two">
         <div class="field"><label for="promotion-pass-mark">Pass mark *</label><input id="promotion-pass-mark" name="promotion_pass_mark" type="number" min="0" max="100" step="0.01" required value="${esc(promotion.promotion_pass_mark??50)}"><span class="field-hint">At or above this mark, the suggested decision is promoted.</span></div>
         <div class="field"><label for="promotion-try-another-min">Try-another threshold *</label><input id="promotion-try-another-min" name="promotion_try_another_min" type="number" min="0" max="100" step="0.01" required value="${esc(promotion.promotion_try_another_min??40)}"><span class="field-hint">Below the pass mark and at or above this threshold suggests trying another class.</span></div>
       </div><div id="promotion-rules-error"></div><div class="page-actions"><button class="btn btn-primary" type="submit" ${state.data.savingPromotionRules?"disabled":""}>${icon("fa-floppy-disk")}${state.data.savingPromotionRules?"Saving…":"Save promotion rules"}</button></div></form></section>
       ${brandingSettingsMarkup(school)}
       ${stampMarkup}`;
   }
  function activityIconsSettingsMarkup(){
    const icons=state.data.activityIcons||[];
    const iconKeys=["writing","listening","reading","speaking","drawing","games","rhymes_stories","music","health_habits","toilet_habits"];
    return `<section class="card section-card"><div class="section-title"><div><h2>Nursery activity icons</h2><p>Upload a school-specific image for each learning activity. Images are automatically resized to 50 × 50 pixels and saved as optimized PNGs.</p></div></div>
      ${state.data.activityIconError?`<div class="alert error" role="alert">${esc(state.data.activityIconError)}</div>`:""}
      <div class="nursery-icon-grid">${NURSERY_ACTIVITY_NAMES.map((name,index)=>{const saved=icons.find(item=>item.activity_name===name);const source=saved?.icon_base64?(saved.icon_base64.startsWith("data:image/")?saved.icon_base64:`data:image/png;base64,${saved.icon_base64}`):`/pdf-templates/nursery-icons/${iconKeys[index]}.png`;const busy=state.data.activityIconBusy===name;return `<article class="nursery-icon-card"><img class="nursery-icon-preview" src="${esc(source)}" alt="${esc(name)} icon"><div class="nursery-icon-details"><strong>${esc(name)}</strong><span>${saved?"Custom school icon":"Default icon"}</span><label class="btn btn-outline btn-sm">${busy?"Uploading…":"Upload icon"}<input type="file" accept="image/*" data-activity-icon-file="${esc(name)}" ${busy?"disabled":""}></label>${saved?`<button type="button" class="text-button nursery-icon-remove" data-action="remove-activity-icon" data-name="${esc(name)}">Use default</button>`:""}</div></article>`}).join("")}</div>
      <p class="field-hint">Custom icons are school-specific and appear in the Nursery activity grid on both the HTML preview and PDF. If none is uploaded, the built-in icon is used.</p>
    </section>`;
  }
  function smsGatewaySettingsMarkup(){
    const wallet=state.data.smsWallet||{current_balance:0,bundles:[],purchase_simulation_enabled:false};
    const bundles=Array.isArray(wallet.bundles)?wallet.bundles:[];
    const simulation=wallet.purchase_simulation_enabled===true;
    const bundleCards=bundles.length?`<div class="sms-bundle-grid">${bundles.map(bundle=>`<article class="sms-bundle-card"><div><span class="eyebrow">SMS bundle</span><h3>${esc(bundle.name)}</h3></div><strong class="sms-bundle-credits">${fmt(bundle.credits)} credits</strong><p class="sms-bundle-price">UGX ${Number(bundle.price||0).toLocaleString("en-UG")}</p>${simulation?`<button class="btn btn-primary btn-block" data-action="buy-sms-bundle" data-id="${esc(bundle.id)}">${icon("fa-bag-shopping")} Simulate purchase</button>`:`<button class="btn btn-outline btn-block" type="button" disabled>Purchase unavailable</button>`}</article>`).join("")}</div>`:empty("No SMS bundles available","Ask the Super Admin to add an SMS bundle.");
    return `<section class="card section-card"><div class="section-title"><div><h2>SMS Gateway</h2><p>Manage SMS credits and send a test message through Africa's Talking.</p></div></div>
      <div class="sms-wallet-overview"><div><span class="eyebrow">Available credits</span><strong id="sms-credit-balance">${fmt(wallet.current_balance??0)}</strong><span>SMS messages</span></div><p>${simulation?"Development-only simulations add credits without collecting or verifying a payment.":"Bundle purchases are unavailable until payment verification is connected. Contact the Super Admin for a manual credit top-up."}</p></div>
      ${state.data.smsWalletError?`<div class="alert error" role="alert">${esc(state.data.smsWalletError)}</div>`:""}
      <div class="sms-bundle-section"><div class="section-title"><div><h3>Available bundles</h3><p>${simulation?"Simulated purchases are enabled only in development.":"Production credits are added by a Super Admin after payment is confirmed."}</p></div></div>${bundleCards}</div>
      <p class="field-hint sms-test-notice">Sending SMS may incur charges. Each accepted message uses one credit. Only message a number you own or have permission to contact. Failed attempts are logged for this school.</p>
      <form id="sms-test-form" class="form-grid" novalidate><div class="form-two">
        <div class="field"><label for="sms-test-recipient">Recipient phone number *</label><input id="sms-test-recipient" name="recipient" type="tel" autocomplete="tel" inputmode="tel" placeholder="+256 700 000 000" maxlength="24" required></div>
        <div class="field"><label for="sms-test-message">Message *</label><textarea id="sms-test-message" name="message" rows="4" maxlength="1600" required placeholder="Type a short test message"></textarea><span class="field-hint">Maximum 1,600 characters.</span></div>
      </div><div id="sms-test-result" aria-live="polite"></div><div class="page-actions"><button class="btn btn-primary" type="submit">${icon("fa-paper-plane")} Send test SMS</button></div></form>
    </section>`;
  }
   function settingsPage(){
     const school=state.data.schoolSettings;
     if(!school)return `${heading("School settings","Set the current school term and the information shown on report cards.")}${state.data.settingsError?errorBox(state.data.settingsError,"settings"):`${loading()}`}`;
     const promotion=state.data.promotionSettings||{promotion_pass_mark:50,promotion_try_another_min:40};
     const active=state.data.settingsTab||"general";
      const tabs=[["general","School"],["theme","Theme"],["grading","Grading scale"],["subjects","Subjects"],["other","Other / co-curricular"],["activity-icons","Activity Icons"],["sms","SMS Gateway"]];
     const tabBar=`<div class="settings-tabs" role="tablist" aria-label="School settings sections">${tabs.map(([key,label])=>`<button type="button" role="tab" aria-selected="${active===key}" class="settings-tab ${active===key?"active":""}" data-action="settings-tab" data-tab="${key}">${label}</button>`).join("")}</div>`;
     let panel="";
      if(active==="theme")panel=themeSettingsMarkup(school);
      else if(active==="grading")panel=gradingPanel();
     else if(active==="subjects")panel=subjectsPanel("CORE");
     else if(active==="other")panel=subjectsPanel("OTHER");
      else if(active==="activity-icons")panel=activityIconsSettingsMarkup();
      else if(active==="sms")panel=smsGatewaySettingsMarkup();
     else{
       const stampMarkup=window.ReportCardStampBuilder?window.ReportCardStampBuilder.render(state.data.stampConfig||{},{saving:state.data.savingStamp===true,error:state.data.stampError||""}):errorBox("Digital stamp controls did not load.");
       panel=generalSettingsMarkup(school,promotion,stampMarkup);
     }
     return `${heading("School settings","Manage report-card details, grading, subjects, and school branding.")}${tabBar}${panel}`;
   }
  function commandCenterPage(){
    const payload=state.data.commandCenter;
    const rows=Array.isArray(payload?.schools)?payload.schools:[];
    const summary=state.data.commandCenterSummary||payload?.summary||{};
    const activeTab=state.data.commandCenterTab||"schools";
    const query=String(state.data.commandCenterSearch||"").trim().toLocaleLowerCase();
    const visibleRows=rows.filter(s=>[s.name,s.short_code,s.city,s.district,s.email,s.phone,s.primary_parent_contact].some(v=>String(v||"").toLocaleLowerCase().includes(query)));
    const table=payload===null?(state.data.commandCenterError?errorBox(state.data.commandCenterError,"refresh-command-center"):loading()):visibleRows.length?`<div class="table-wrap"><table class="command-center-table"><thead><tr><th>School name</th><th>Location</th><th>Admin contact</th><th>Learners</th><th>View</th></tr></thead><tbody>${visibleRows.map(school=>`<tr><td class="cc-school-name"><strong title="${esc(school.name)}">${esc(school.name||"Unnamed school")}</strong><small>${esc(school.short_code||"School")}</small></td><td><span>${esc([school.city,school.district].filter(Boolean).join(", ")||"—")}</span></td><td><span class="cc-contact">${esc(school.email||"—")}</span><small class="cc-contact">${esc(school.phone||"—")}</small></td><td><strong>${fmt(school.learner_count??0)}</strong><small class="cc-gender-counts">M ${fmt(school.male_count??0)} <span aria-hidden="true">·</span> F ${fmt(school.female_count??0)}</small></td><td><button class="btn btn-quiet btn-small" data-action="view-command-school" data-id="${esc(school.id)}" aria-label="View details for ${esc(school.name)}">View details</button></td></tr>`).join("")}</tbody></table></div>`:query?empty("No matching schools","Try another school name, location or contact."):empty("No schools yet","Provision the first school to begin your network overview.",button("Provision a school","open-provision-modal","fa-plus","btn-primary"));
    const bundles=Array.isArray(state.data.commandCenterBundles)?state.data.commandCenterBundles:[];
    const bundlePanel=`<section class="card section-card command-center-schools"><div class="section-title cc-schools-title"><div><h2>SMS Bundles</h2><p>Manage credit bundles shown to school administrators. No payment provider is connected yet.</p></div><button class="btn btn-primary" data-action="add-sms-bundle">${icon("fa-plus")} Add bundle</button></div>${bundles.length?`<div class="table-wrap"><table class="command-center-table"><thead><tr><th>Bundle</th><th>Credits</th><th>Price (UGX)</th><th>Actions</th></tr></thead><tbody>${bundles.map(bundle=>`<tr><td><strong>${esc(bundle.name)}</strong></td><td>${fmt(bundle.credits)}</td><td>${Number(bundle.price||0).toLocaleString("en-UG")}</td><td class="sms-bundle-actions"><button class="btn btn-outline btn-small" data-action="edit-sms-bundle" data-id="${esc(bundle.id)}">${icon("fa-pen")} Edit</button><button class="btn btn-quiet btn-small" data-action="delete-sms-bundle" data-id="${esc(bundle.id)}" aria-label="Delete ${esc(bundle.name)}">${icon("fa-trash")} Delete</button></td></tr>`).join("")}</tbody></table></div>`:empty("No bundles yet","Add a bundle to make it available to schools.",button("Add first bundle","add-sms-bundle","fa-plus","btn-primary"))}</section>`;
    const action=activeTab==="schools"?button("Provision New School","open-provision-modal","fa-plus","btn-primary"):"";
    const tabBar=`<div class="settings-tabs cc-tabs" role="tablist" aria-label="Command Center sections"><button type="button" role="tab" aria-selected="${activeTab==="schools"}" class="settings-tab ${activeTab==="schools"?"active":""}" data-action="command-center-tab" data-tab="schools">Schools</button><button type="button" role="tab" aria-selected="${activeTab==="sms-bundles"}" class="settings-tab ${activeTab==="sms-bundles"?"active":""}" data-action="command-center-tab" data-tab="sms-bundles">SMS Bundles</button></div>`;
    const schoolsPanel=`<section class="card section-card command-center-schools"><div class="section-title cc-schools-title"><div><h2>Schools</h2><p>${payload===null?"Loading school records":`${rows.length} school${rows.length===1?"":"s"} in your network`}</p></div><button class="btn btn-outline" data-action="refresh-command-center" ${state.data.commandCenterLoading?"disabled":""}>${icon("fa-rotate")} Refresh</button></div><div class="toolbar cc-search"><label class="cc-search-label" for="cc-school-search">Find a school</label><div class="cc-search-input">${icon("fa-magnifying-glass")}<input id="cc-school-search" type="search" placeholder="Name, location, email or phone" value="${esc(state.data.commandCenterSearch||"")}" aria-label="Search schools"></div></div>${table}</section>`;
    const summaryCards=`<div class="cc-summary-grid">${[["Total schools",summary.total_schools,"fa-school"],["Total learners",summary.total_learners,"fa-user-graduate"],["Total parents",summary.total_parents,"fa-people-group"]].map(([label,value,ico],index)=>`<article class="card cc-summary-card cc-summary-${index}"><span class="cc-summary-icon">${icon(ico)}</span><span class="cc-summary-label">${label}</span><strong>${payload===null?"—":fmt(value??0)}</strong><small>Across all provisioned schools</small></article>`).join("")}</div>`;
    return `${heading("Command Center","A clear view of every ReportCards school.",action)}${tabBar}${activeTab==="sms-bundles"?bundlePanel:`${summaryCards}${schoolsPanel}`}`;
  }
  function currentView(){if(state.route==="command-center"&&state.role==="super_admin")return commandCenterPage();if(state.route==="dashboard")return dashboard();if(state.route==="classes")return classesPage();if(state.route==="learners")return learnersPage();if(state.route==="subjects")return subjectsPage();if(state.route==="grading")return gradingPage();if(state.route==="teachers")return teachersPage();if(state.route==="marks")return state.role==="teacher"?teacherMarksPage():marksPage();if(state.route==="attendance")return window.ReportCardsAttendance?window.ReportCardsAttendance.render():errorBox("Attendance interface did not load.");if(state.route==="announcements")return window.ReportCardsParentAdmin?window.ReportCardsParentAdmin.renderAnnouncements(state):errorBox("Announcements interface did not load.");if(state.route==="parent-feedback")return window.ReportCardsParentAdmin?window.ReportCardsParentAdmin.renderFeedback(state):errorBox("Parent feedback interface did not load.");if(state.route==="review"&&state.role==="school_admin")return reviewPage();if(state.route==="projects")return projectsPage();if(state.route==="finance")return window.ReportCardsFinance?window.ReportCardsFinance.render(state):errorBox("Finance interface did not load.");if(state.route==="settings")return settingsPage();if(state.route==="reports")return reportsPage();return dashboard()}
  function renderPasswordChange(){root.innerHTML=`<main class="auth-shell"><section class="auth-card" aria-labelledby="password-title"><div class="brand"><span class="brand-mark"></span>appshule</div><h1 id="password-title">Set a new password</h1><p class="lede">Your administrator gave you a temporary password. Choose a new password of at least 8 characters before continuing.</p><div id="modal-error"></div><form id="modal-form" class="form-grid" data-type="change-password" data-method="POST" data-endpoint="/api/auth/change-password" novalidate><div class="field"><label for="old_password">Temporary password</label><input id="old_password" name="old_password" type="password" autocomplete="current-password" required maxlength="200"></div><div class="field"><label for="new_password">New password</label><input id="new_password" name="new_password" type="password" autocomplete="new-password" minlength="8" required maxlength="200"></div><div class="field"><label for="confirm_password">Confirm new password</label><input id="confirm_password" name="confirm_password" type="password" autocomplete="new-password" minlength="8" required maxlength="200"></div><button class="btn btn-primary btn-block" type="submit">Change password ${icon("fa-arrow-right")}</button><button class="text-button" type="button" data-action="logout">Sign out</button></form></section></main>`}
  let previewCountSequence=0,previewCountPending="",previewCountCache=new Map();
  function applyPreviewScale(){
    if(state.route!=="reports")return;
    root.querySelectorAll(".rc-preview-stage").forEach(stage=>{
      const box=stage.querySelector(".rc-preview-paper-box"),paper=stage.querySelector(".rc-preview-paper");
      if(!box||!paper)return;
      const pageWidth=(paper.dataset.layoutFormat==="A5_CONDENSED"?148:210)*96/25.4;
      const pageHeight=(paper.dataset.layoutFormat==="A5_CONDENSED"?210:297)*96/25.4;
      const fit=Math.min(1,stage.clientWidth/pageWidth,stage.clientHeight/pageHeight);
      const scale=fit*Math.max(.5,Math.min(1.8,Number(reportState.zoom)||1)*.01);
      box.style.width=`${pageWidth*scale}px`;box.style.height=`${pageHeight*scale}px`;
      paper.style.transform=`scale(${scale})`;
      const article=paper.querySelector(".rc-preview"),content=article?.querySelector(".rc-preview-content");
      if(article&&content){
        const fitContent=Math.min(1,(article.clientHeight-18)/Math.max(content.scrollHeight,1));
        content.style.transform=`scale(${fitContent})`;
        content.style.transformOrigin="top center";
      }
    });
  }
  function updateReportPreviewPageCount(){
    if(state.route!=="reports"){previewCountSequence++;previewCountPending="";return}
    const markers=root.querySelectorAll(".rc-page-count");
    const data=reportState.data;
    const selected=(data?.learners||[]).find(item=>String(item.learner?.id)===String(reportState.learnerId));
    if(!markers.length||!selected)return;
    const report=selected;
    const level=data.class?.level||"NURSERY";
    const rowCount=[report.subjects?.length||0,report.projects?.length||0,report.activities?.length||0,report.other_subjects?.length||0];
    const key=JSON.stringify([reportState.classId,reportState.learnerId,reportState.term,reportState.year,reportState.template,reportState.period,reportState.layoutFormat,level,rowCount]);
    if(reportState.layoutFormat==="A5_CONDENSED"){
      previewCountCache.set(key,1);
      markers.forEach(marker=>{marker.textContent="Page 1 of 1";marker.setAttribute("aria-label","A5 condensed report is one page")});
      return;
    }
    if(previewCountCache.has(key)){
      const count=previewCountCache.get(key);markers.forEach(marker=>{marker.textContent=`Page 1 of ${count}`;marker.setAttribute("aria-label",`PDF report spans ${count} pages`)});return;
    }
    markers.forEach(marker=>marker.textContent="Calculating pages…");
    if(previewCountPending===key)return;
    previewCountPending=key;
    const sequence=++previewCountSequence;
    const ages=(data.learners||[]).map(item=>Number(item.learner?.age)).filter(age=>Number.isFinite(age)&&age>0);
    const previewReport={...report,school:data.school,class:data.class,term:data.term,year:data.year,period:reportState.period,layout_format:reportState.layoutFormat,term_dates:data.term_dates,level_theme:data.level_theme,stamp_config:data.stamp_config,class_average_age:ages.length?ages.reduce((sum,age)=>sum+age,0)/ages.length:null};
    Promise.resolve().then(async()=>{
      if(!window.ReportCardPdf||!window.PDFLib?.PDFDocument)throw new Error("PDF page count unavailable");
      const bytes=await window.ReportCardPdf.render(previewReport,level,reportState.template,false,reportState.layoutFormat);
      const pdf=await window.PDFLib.PDFDocument.load(bytes);
      if(sequence!==previewCountSequence)return;
      const count=pdf.getPageCount();
      previewCountCache.set(key,count);
      if(previewCountCache.size>12)previewCountCache.delete(previewCountCache.keys().next().value);
      previewCountPending="";
      root.querySelectorAll(".rc-page-count").forEach(current=>{current.textContent=`Page 1 of ${count}`;current.setAttribute("aria-label",`PDF report spans ${count} pages`)});
    }).catch(()=>{
      if(sequence!==previewCountSequence)return;
      previewCountPending="";
      root.querySelectorAll(".rc-page-count").forEach(current=>{current.textContent="Page count unavailable";current.removeAttribute("aria-label")});
    });
  }
  function enhanceMarkRegister(){const table=root.querySelector("#marks-table,#teacher-marks-table");const panel=table?.closest(".section-card");if(!panel)return;panel.classList.add("marks-register-panel");const title=panel.querySelector(".section-title");if(!title||title.querySelector('[data-action="toggle-mark-fullscreen"]'))return;const button=document.createElement("button");button.type="button";button.className="btn btn-outline";button.dataset.action="toggle-mark-fullscreen";button.setAttribute("aria-label","Expand assessment register");button.innerHTML=`${icon("fa-expand")} Full screen`;title.append(button)}
  function enhanceSchoolLogoHeader(){const source=schoolLogoSource(state.school?.logo_base64);if(!source)return;const topbar=root.querySelector(".topbar"),date=topbar?.querySelector(".topbar-date");if(!topbar||!date)return;let right=topbar.querySelector(".topbar-right");if(!right){right=document.createElement("div");right.className="topbar-right";date.replaceWith(right);right.append(date)}if(!right.querySelector(".topbar-school-logo")){const image=document.createElement("img");image.className="topbar-school-logo";image.src=source;image.alt=`${schoolName()} logo`;right.insertBefore(image,date)}}
  function toggleMarkFullscreen(){const panel=root.querySelector(".marks-register-panel");if(!panel)return;const active=panel.classList.toggle("is-fullscreen");document.body.classList.toggle("marks-entry-fullscreen",active);const button=panel.querySelector('[data-action="toggle-mark-fullscreen"]');if(button){button.innerHTML=`${icon(active?"fa-compress":"fa-expand")} ${active?"Exit full screen":"Full screen"}`;button.setAttribute("aria-label",active?"Exit full-screen assessment register":"Expand assessment register")}}
  function exitMarkFullscreen(){root.querySelector(".marks-register-panel.is-fullscreen")?.classList.remove("is-fullscreen");document.body.classList.remove("marks-entry-fullscreen")}
  function render(){exitMarkFullscreen();if(!state.token){if(landingRequested()&&window.AppShuleLanding?.render){window.AppShuleLanding.render(root);return}renderAuth();return}if(state.mustChangePassword){renderPasswordChange();return}root.innerHTML=shell(currentView());const admissionInput=root.querySelector("#f-reg_no");if(admissionInput){const autoNumbering=state.data.schoolSettings?.admission_number_mode==="auto";admissionInput.required=!autoNumbering;const label=root.querySelector('label[for="f-reg_no"]');if(label)label.textContent=autoNumbering?"Admission number (auto-generated)":"Admission number *";const field=label?.closest(".field");if(field){let hint=field.querySelector("[data-admission-hint]");if(!hint){hint=document.createElement("span");hint.className="field-hint";hint.dataset.admissionHint="true";field.append(hint)}hint.textContent=autoNumbering?"A sequential number will be assigned when you save.":"Enter a number manually; required while manual numbering is enabled."}}if(state.modal?.type==="learner-profile"&&state.role==="school_admin"){const actions=root.querySelector(".modal-actions");if(actions&&!actions.querySelector('[data-action="invite-parent"]'))actions.insertAdjacentHTML("afterbegin",`<button class="btn btn-outline" data-action="invite-parent" data-id="${esc(state.modal.learner?.id)}">${icon("fa-envelope")} Invite parent</button>`)}enhanceSchoolLogoHeader();if(state.route==="marks")enhanceMarkRegister();if(state.route==="settings")window.ReportCardStampBuilder?.bind(root,state.data.stampConfig||{});if(state.route==="reports"){updateReportPreviewPageCount();requestAnimationFrame(applyPreviewScale)}else if(previewCountPending){previewCountSequence++;previewCountPending="";}}
  function renderAuth(){const signupDisabled=requestedPath==="/signup";root.innerHTML=`<main class="auth-shell"><section class="auth-card" aria-labelledby="auth-title"><div class="brand"><span class="brand-mark"></span>appshule</div><h1 id="auth-title">Welcome back</h1><p class="lede">Sign in with the same email or phone number and password you use for your school, staff, or parent account.</p>${signupDisabled?'<div class="alert info" role="status">Public school account creation is closed. Contact AppShule to have a school provisioned.</div>':""}<div id="auth-error"></div><form id="auth-form" class="form-grid" novalidate><div class="field"><label for="email">Email or Phone Number</label><input id="email" name="email" type="text" required autocomplete="username" maxlength="254"></div><div class="field"><label for="password">Password</label><div class="auth-password-wrap"><input id="password" name="password" type="password" required autocomplete="current-password" maxlength="200"><button class="auth-password-toggle" type="button" data-action="toggle-password" data-target="password" aria-label="View password" aria-pressed="false">${icon("fa-eye")}</button></div></div><button class="btn btn-primary btn-block" type="submit" ${state.loading?"disabled":""}>${state.loading?"Please wait…":"Sign in"} ${icon("fa-arrow-right-to-bracket")}</button></form><p class="auth-footer">Need a school account? <a href="/#contact">Contact AppShule</a></p><p class="auth-footer">Parents can also sign in here. <a href="/parent-dashboard.html">Parent portal</a></p></section></main>`}
  const renderWithAdmissionNumber=render;
  render=function(){
    renderWithAdmissionNumber();
    if(!state.token)return;
    const input=root.querySelector("#f-reg_no");
    if(!input)return;
    const isNew=state.modal?.type==="learner"&&!state.modal.item?.id;
    const automatic=(state.data.schoolSettings?.admission_number_mode||state.school?.admission_number_mode)==="auto";
    input.required=!(automatic&&isNew);
    input.readOnly=automatic&&isNew;
    if(automatic&&isNew)input.value=state.modal.admissionPreview||"";
    const label=root.querySelector('label[for="f-reg_no"]');
    if(label)label.textContent=automatic?"Admission number (auto-generated)":"Admission number *";
    const field=label?.closest(".field");
    if(field){
      let hint=field.querySelector("[data-admission-hint]");
      if(!hint){hint=document.createElement("span");hint.className="field-hint";hint.dataset.admissionHint="true";field.append(hint)}
      hint.textContent=automatic&&isNew
        ?state.modal.admissionPreview?`Next available number: ${state.modal.admissionPreview}. The server confirms it when saved.`:"Loading the next admission number…"
        :automatic?"Automatic numbering is enabled for new learners; existing numbers are managed by the school."
        :"Enter a number manually; required while manual numbering is enabled.";
    }
  };
    function modalMarkup(){
      const m=state.modal;
      if(!m)return"";
      if(m.type==="command-center-sms-bundle"){
        const bundle=m.bundle||{};
        return `<div class="modal-backdrop cc-backdrop" data-action="backdrop"><section class="modal cc-provision-modal" role="dialog" aria-modal="true" aria-labelledby="cc-sms-bundle-title"><div class="modal-head"><div><p class="eyebrow">Command Center</p><h2 id="cc-sms-bundle-title">${bundle.id?"Edit SMS bundle":"Add SMS bundle"}</h2><p>Prices are listed in Uganda shillings (UGX).</p></div><button class="close-btn" data-action="close-modal" aria-label="Close bundle dialog">${icon("fa-xmark")}</button></div><form id="cc-sms-bundle-form" class="form-grid" data-id="${esc(bundle.id||"")}" novalidate><div class="field"><label for="cc-sms-bundle-name">Bundle name *</label><input id="cc-sms-bundle-name" name="name" required maxlength="80" value="${esc(bundle.name||"")}"></div><div class="form-two"><div class="field"><label for="cc-sms-bundle-credits">SMS credits *</label><input id="cc-sms-bundle-credits" name="credits" type="number" min="1" max="1000000" step="1" required value="${esc(bundle.credits??"")}"></div><div class="field"><label for="cc-sms-bundle-price">Price (UGX) *</label><input id="cc-sms-bundle-price" name="price" type="number" min="1" max="1000000000" step="1" required value="${esc(bundle.price??"")}"></div></div><div id="cc-sms-bundle-error" aria-live="polite"></div><div class="modal-actions"><button class="btn btn-outline" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit" ${m.busy?"disabled":""}>${icon("fa-floppy-disk")} ${m.busy?"Saving…":"Save bundle"}</button></div></form></section></div>`;
      }
      if(m.type==="sms-bundle-purchase"){
        const bundle=m.bundle||{};
        return `<div class="modal-backdrop" data-action="backdrop"><section class="modal sms-purchase-modal" role="dialog" aria-modal="true" aria-labelledby="sms-purchase-title"><div class="modal-head"><div><p class="eyebrow">SMS Wallet</p><h2 id="sms-purchase-title">Simulate bundle purchase</h2><p>${esc(bundle.name||"SMS bundle")} · ${fmt(bundle.credits)} credits · UGX ${Number(bundle.price||0).toLocaleString("en-UG")}</p></div><button class="close-btn" data-action="close-modal" aria-label="Close purchase dialog">${icon("fa-xmark")}</button></div><div class="alert warning" role="note">Development-only simulation. No Mobile Money payment is collected or verified. This action adds test credits only in development.</div>${m.error?`<div class="alert error" role="alert">${esc(m.error)}</div>`:""}<div class="modal-actions"><button class="btn btn-outline" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="confirm-sms-bundle-purchase" ${m.busy?"disabled":""}>${icon("fa-check")} ${m.busy?"Adding…":"Add simulated credits"}</button></div></section></div>`;
      }
      if(m.type==="command-center-provision")return `<div class="modal-backdrop cc-backdrop" data-action="backdrop"><section class="modal cc-provision-modal" role="dialog" aria-modal="true" aria-labelledby="cc-provision-title" aria-describedby="cc-provision-description"><div class="modal-head"><div><p class="eyebrow">New school</p><h2 id="cc-provision-title">Provision a school</h2><p id="cc-provision-description">Create the school and its administrator sign-in.</p></div><button class="close-btn" data-action="close-modal" aria-label="Close provisioning dialog">${icon("fa-xmark")}</button></div><form id="command-center-provision-form" class="form-grid" novalidate><div class="field"><label for="cc-school-name">School name *</label><input id="cc-school-name" name="name" required maxlength="200" autocomplete="organization"></div><div class="form-two"><div class="field"><label for="cc-email">School admin email *</label><input id="cc-email" name="email" type="email" required maxlength="254" autocomplete="email"></div><div class="field"><label for="cc-phone">School phone *</label><input id="cc-phone" name="phone" type="tel" required maxlength="60" autocomplete="tel"></div><div class="field"><label for="cc-head-teacher">Head teacher</label><input id="cc-head-teacher" name="head_teacher_name" maxlength="200" autocomplete="name"></div><div class="field"><label for="cc-city">City</label><input id="cc-city" name="city" maxlength="200"></div><div class="field wide"><label for="cc-district">District</label><input id="cc-district" name="district" maxlength="200"></div><div class="field wide"><label for="cc-password">Temporary school-admin password *</label><input id="cc-password" name="initial_password" type="password" required minlength="14" maxlength="200" autocomplete="new-password"><span class="field-hint">At least 14 characters with uppercase and lowercase letters, a number, and a symbol. The admin must change it at first login.</span></div></div><div id="command-center-form-error" aria-live="polite"></div><div class="modal-actions"><button class="btn btn-outline" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit" ${state.data.provisioningSchool?"disabled":""}>${icon("fa-school")} ${state.data.provisioningSchool?"Creating…":"Create school"}</button></div></form></section></div>`;
      if(m.type==="command-center-school"){
        const details=m.details||{},school=details.school||{},stats=details.stats||{};
        const list=(title,items,kind)=>`<section class="cc-detail-section"><div class="cc-detail-section-head"><h3>${title}</h3><span>${items.length}</span></div>${items.length?`<ul class="cc-contact-list">${items.map(person=>`<li><strong>${esc(person.name||"Name unavailable")}</strong><span>${esc(person.email||"No email provided")}</span><span>${esc(person.phone||"No phone provided")}</span></li>`).join("")}</ul>`:`<p class="cc-detail-empty">No ${kind} are listed for this school.</p>`}</section>`;
        const title=school.name||m.schoolName||"School details";
        const smsWallet=details.sms_wallet||{current_balance:0};
        return `<div class="modal-backdrop cc-backdrop" data-action="backdrop"><section class="modal cc-details-modal" role="dialog" aria-modal="true" aria-labelledby="cc-details-title">${m.loading?`<div class="modal-head"><div><p class="eyebrow">School record</p><h2 id="cc-details-title">${esc(title)}</h2><p>Loading school details…</p></div><button class="close-btn" data-action="close-modal" aria-label="Close school details">${icon("fa-xmark")}</button></div><div class="cc-detail-skeleton"><div></div><div></div><div></div></div>`:m.error?`<div class="modal-head"><div><p class="eyebrow">School record</p><h2 id="cc-details-title">${esc(title)}</h2><p>School details could not be loaded.</p></div><button class="close-btn" data-action="close-modal" aria-label="Close school details">${icon("fa-xmark")}</button></div><div class="alert error" role="alert">${esc(m.error)}</div><div class="modal-actions"><button class="btn btn-outline" data-action="close-modal">Close</button><button class="btn btn-primary" data-action="retry-command-school-details" data-id="${esc(m.id)}">${icon("fa-rotate")} Try again</button></div>`:`<div class="modal-head"><div><p class="eyebrow">School record${school.short_code?` · ${esc(school.short_code)}`:""}</p><h2 id="cc-details-title">${esc(title)}</h2><p>${esc([school.city,school.district].filter(Boolean).join(", ")||"Location not provided")} · ${esc(school.subscription_status||"Status unavailable")}</p></div><button class="close-btn" data-action="close-modal" aria-label="Close school details">${icon("fa-xmark")}</button></div><div class="cc-detail-summary">${[["Learners",stats.learner_count,"fa-user-graduate"],["Male",stats.male_count,"fa-person"],["Female",stats.female_count,"fa-person-dress"],["Parents",stats.parent_count,"fa-people-group"],["Teachers",stats.teacher_count,"fa-chalkboard-user"]].map(([label,value,ico])=>`<div><span>${icon(ico)} ${label}</span><strong>${fmt(value??0)}</strong></div>`).join("")}</div><dl class="cc-school-contact"><div><dt>Admin email</dt><dd>${fmt(school.email)}</dd></div><div><dt>School phone</dt><dd>${fmt(school.phone)}</dd></div><div><dt>Created</dt><dd>${school.created_at?esc(new Date(school.created_at).toLocaleDateString("en-UG",{day:"numeric",month:"short",year:"numeric"})):"—"}</dd></div></dl><section class="cc-sms-wallet"><div><span class="eyebrow">SMS Wallet</span><strong>${fmt(smsWallet.current_balance??0)} credits</strong><p>Manual top-ups are available to Super Admin only.</p></div><form id="cc-sms-credit-form" class="cc-sms-credit-form" data-school-id="${esc(school.id||m.id)}"><div class="form-two"><div class="field"><label for="cc-sms-credit-amount">Credits to add *</label><input id="cc-sms-credit-amount" name="credits" type="number" min="1" max="1000000" step="1" required></div><div class="field"><label for="cc-sms-amount-paid">Amount paid (UGX)</label><input id="cc-sms-amount-paid" name="amount_paid" type="number" min="0" step="1" value="0"></div><div class="field wide"><label for="cc-sms-reference">Payment reference (optional)</label><input id="cc-sms-reference" name="reference" maxlength="200" placeholder="Receipt or transaction reference"></div></div><div id="cc-sms-credit-result" aria-live="polite"></div><button class="btn btn-primary" type="submit">${icon("fa-circle-plus")} Add credits</button></form></section><div class="cc-people-grid">${list("Teachers",details.teachers||[],"teachers")}${list("Parents",details.parents||[],"parents")}</div><div class="modal-actions"><button class="btn btn-outline" data-action="close-modal">Close</button></div>`}</section></div>`;
      }
      if(m.type==="learner-profile"){
        if(m.loading)return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">Learner profile</h2><p>Loading learner details…</p></div><button class="close-btn" data-action="close-modal" aria-label="Close">${icon("fa-xmark")}</button></div>${loading()}</section></div>`;
        if(m.error)return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">Learner profile</h2><p>Could not load learner details.</p></div><button class="close-btn" data-action="close-modal" aria-label="Close">${icon("fa-xmark")}</button></div><div class="alert error" role="alert">${esc(m.error)}</div><div class="modal-actions"><button class="btn btn-outline" data-action="close-modal">Close</button></div></section></div>`;
        const learner=m.learner||{},schoolClass=(state.data.classes||[]).find(c=>String(c.id)===String(learner.class_id));
        const fields=[["Registration number",learner.reg_no],["LIN",learner.lin],["Class",schoolClass?`${schoolClass.name}${schoolClass.stream?` · ${schoolClass.stream}`:""}`:"—"],["Gender",learner.gender],["Age",learner.age],["Section",learner.section],["House",learner.house],["Combination",learner.combination],["Parent / guardian",learner.parent_name],["Parent phone",learner.parent_phone],["Parent email",learner.parent_email],["Created",learner.created_at?new Date(learner.created_at).toLocaleDateString("en-UG"):"—"]];
        return `<div class="modal-backdrop" data-action="backdrop"><section class="modal learner-profile-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">${esc(learner.full_name||"Learner profile")}</h2><p>Learner details and guardian contact</p></div><button class="close-btn" data-action="close-modal" aria-label="Close">${icon("fa-xmark")}</button></div>${learner.photo_base64?`<img class="learner-profile-photo" src="${esc(learner.photo_base64)}" alt="${esc(learner.full_name||"Learner")}">`:""}<dl class="learner-profile-grid">${fields.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${fmt(value)}</dd></div>`).join("")}</dl><div class="modal-actions"><button class="btn btn-outline" data-action="close-modal">Close</button><button class="btn btn-primary" data-action="edit-profile-learner" data-id="${esc(learner.id)}">${icon("fa-pen")} Edit learner</button></div></section></div>`;
      }
      if(m.type==="review-entry")return `<div class="modal-backdrop" data-action="backdrop"><section class="modal review-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">Review ${esc(m.submission.class_name||"class")} · ${esc(m.submission.subject_name||"subject")}</h2><p>${esc(m.period.term)} · ${esc(m.period.year)} — edit scores if needed, then save.</p></div><button class="close-btn" data-action="close-modal" aria-label="Close">${icon("fa-xmark")}</button></div><div class="table-wrap"><table id="review-edit-table"><thead><tr><th>Learner</th><th>A1</th><th>A2</th><th>A3</th><th>EOT</th></tr></thead><tbody>${m.learners.map(l=>`<tr data-learner="${esc(l.learner_id)}"><td>${esc(l.full_name)}</td>${["a1","a2","a3","eot"].map(k=>`<td><input class="mark-input" type="number" min="0" max="${k==="eot"?100:3}" step=".01" data-review-score="${k}" value="${l[k]??""}" aria-label="${esc(l.full_name)} ${k}"></td>`).join("")}</tr>`).join("")}</tbody></table></div><div class="modal-actions"><button class="btn btn-outline" data-action="close-modal">Close</button><button class="btn btn-primary" data-action="save-review-edit">${icon("fa-floppy-disk")} Save edits</button></div></section></div>`;
      if(m.type==="password-success"){
        const accountType=m.accountType==="parent"?"parent":"teacher";
        return `<div class="modal-backdrop" data-action="backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">Temporary password ready</h2><p>Share this temporary credential securely with the ${accountType}.</p></div><button class="close-btn" data-action="close-modal" aria-label="Close">${icon("fa-xmark")}</button></div><div class="password-reveal"><label>Temporary password — shown once</label><div class="copy-line"><code id="temp-password">${esc(m.password)}</code><button class="btn btn-primary" data-action="copy-password">${icon("fa-copy")} Copy Password</button></div>${m.accountEmail?`<p class="password-warning">Account: ${esc(m.accountEmail)}</p>`:""}${m.loginUrl?`<p class="password-warning">Login page: <a href="${esc(m.loginUrl)}" target="_blank" rel="noopener noreferrer">${esc(m.loginUrl)}</a></p>`:""}<p class="password-warning">This password is not saved in the app. The account holder should change it after signing in.</p></div><div class="modal-actions"><button class="btn btn-primary" data-action="close-modal">Done</button></div></section></div>`;
      }
      if(m.type==="confirm-teacher-reset")return `<div class="modal-backdrop" data-action="backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">Reset teacher password?</h2><p>A new temporary password will be generated. The teacher will need to change it after signing in.</p></div><button class="close-btn" data-action="close-modal" aria-label="Close">${icon("fa-xmark")}</button></div><div class="modal-actions"><button class="btn btn-outline" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="confirm-teacher-reset" data-id="${esc(m.teacherId)}">Reset password</button></div></section></div>`;
    if(m.type==="import-result")return `<div class="modal-backdrop" data-action="backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">CSV import results</h2><p>${esc(m.created)} learners created${m.errors.length?`; ${m.errors.length} row${m.errors.length===1?"":"s"} need attention`:"."}</p></div><button class="close-btn" data-action="close-modal" aria-label="Close">${icon("fa-xmark")}</button></div>${m.errors.length?`<ul class="row-errors">${m.errors.map(e=>`<li>Row ${esc(e.row)}: ${esc(e.error)}</li>`).join("")}</ul>`:`<div class="alert success">All valid rows were imported.</div>`}<div class="modal-actions"><button class="btn btn-primary" data-action="close-modal">Done</button></div></section></div>`;
    if(m.type==="finance-import-result")return `<div class="modal-backdrop" data-action="backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">Payment import results</h2><p>${esc(m.created)} payments recorded${m.errors.length?`; ${m.errors.length} row${m.errors.length===1?"":"s"} need attention`:"."}</p></div><button class="close-btn" data-action="close-modal" aria-label="Close">${icon("fa-xmark")}</button></div>${m.errors.length?`<ul class="row-errors">${m.errors.map(e=>`<li>Row ${esc(e.row)}: ${esc(e.error)}</li>`).join("")}</ul>`:`<div class="alert success">All payments were imported.</div>`}<div class="modal-actions"><button class="btn btn-primary" data-action="close-modal">Done</button></div></section></div>`;
    const editing=!!m.item, item=m.item||{};
    let title="",body="",endpoint="",method=editing?"PATCH":"POST";
    if(m.type==="project"){
      const projectTerm=state.route==="projects"?projectState.term:reportState.term;
      const projectYear=state.route==="projects"?projectState.year:reportState.year;
      const learnerField=m.learnerId
        ?`<input type="hidden" name="learner_id" value="${esc(m.learnerId)}">`
        :`<div class="field wide"><label for="f-learner_id">Learner *</label><select id="f-learner_id" name="learner_id" required><option value="">Choose a learner</option>${(state.data.projectRegister?.learners||[]).map(learner=>`<option value="${esc(learner.id)}">${esc(learner.full_name)} · ${esc(learner.reg_no||"")}</option>`).join("")}</select></div>`;
      title=editing?"Edit project":"Add a project";
      endpoint=editing?`/api/projects/${encodeURIComponent(item.id)}`:"";
      body=`${editing?"":`${learnerField}<input type="hidden" name="term" value="${esc(projectTerm)}"><input type="hidden" name="year" value="${esc(projectYear)}">`}<div class="form-two"><div class="field wide"><label for="f-project_name">Project name *</label><input id="f-project_name" name="project_name" required maxlength="200" value="${esc(item.project_name||"")}" placeholder="e.g. School garden study"></div><div class="field"><label for="f-score">Score</label><input id="f-score" name="score" type="number" min="0" max="1000" step="0.01" value="${esc(item.score??"")}"></div><div class="field"><label for="f-out_of">Out of *</label><input id="f-out_of" name="out_of" type="number" min="0.01" max="1000" step="0.01" required value="${esc(item.out_of??10)}"></div><div class="field wide"><label for="f-remarks">Remarks</label><textarea id="f-remarks" name="remarks" maxlength="1000">${esc(item.remarks||"")}</textarea></div><div class="field"><label for="f-teacher_initials">Teacher initials</label><input id="f-teacher_initials" name="teacher_initials" maxlength="20" value="${esc(item.teacher_initials||"")}"></div></div><p class="form-hint">The grade and percentage are calculated from the score.</p>`;
    }
     if(m.type==="class"){title=editing?"Edit class":"Add a class";endpoint=editing?`/api/classes/${encodeURIComponent(item.id)}`:"/api/classes";body=`<div class="form-two"><div class="field wide"><label for="f-name">Class name *</label><input id="f-name" name="name" required value="${esc(item.name||"")}" maxlength="120" placeholder="P.1"></div><div class="field"><label for="f-level">Level *</label><select id="f-level" name="level" required>${levelOptions(item.level)}</select></div><div class="field"><label for="f-stream">Stream</label><input id="f-stream" name="stream" value="${esc(item.stream||"")}" maxlength="80" placeholder="A"></div><div class="field wide"><label for="f-class_teacher_id">Class teacher</label><select id="f-class_teacher_id" name="class_teacher_id">${classTeacherOptions(item.class_teacher_id)}</select><span class="field-hint">Choose a teacher marked as a class teacher to enable learner comments.</span></div></div>`}
     if(m.type==="learner"){title=editing?"Edit learner":"Register a learner";endpoint=editing?`/api/learners/${encodeURIComponent(item.id)}`:"/api/learners";body=`<div class="form-two"><div class="field wide"><label for="f-class_id">Class *</label><select name="class_id" id="f-class_id" required>${classOptions(item.class_id,false)}</select></div><div class="field"><label for="f-reg_no">Registration number *</label><input id="f-reg_no" name="reg_no" required maxlength="120" value="${esc(item.reg_no||"")}"></div><div class="field"><label for="f-full_name">Full name *</label><input id="f-full_name" name="full_name" required maxlength="200" value="${esc(item.full_name||"")}"></div><div class="field"><label for="f-gender">Gender</label><select id="f-gender" name="gender"><option value="">Not specified</option>${["Female","Male","Other"].map(v=>`<option ${item.gender===v?"selected":""}>${v}</option>`).join("")}</select></div><div class="field"><label for="f-age">Age</label><input id="f-age" name="age" type="number" min="0" max="120" value="${esc(item.age??"")}"></div><div class="field"><label for="f-house">House</label><input id="f-house" name="house" maxlength="80" value="${esc(item.house||"")}" placeholder="e.g. Lions"></div><div class="field"><label for="f-parent_name">Parent / guardian</label><input id="f-parent_name" name="parent_name" maxlength="200" value="${esc(item.parent_name||"")}"></div><div class="field"><label for="f-parent_phone">Parent phone</label><input id="f-parent_phone" name="parent_phone" type="tel" maxlength="60" value="${esc(item.parent_phone||"")}"></div><div class="field wide"><label for="f-parent_email">Parent email</label><input id="f-parent_email" name="parent_email" type="email" maxlength="254" value="${esc(item.parent_email||"")}"></div></div>`}
     if(m.type==="learner"){body=body.replace('<div class="field"><label for="f-full_name">',`<div class="field"><label for="f-schoolpay_code">SchoolPay Code</label><input id="f-schoolpay_code" name="schoolpay_code" maxlength="120" value="${esc(item.schoolpay_code||"")}"></div><div class="field"><label for="f-full_name">`);const photo=item.photo_base64?schoolLogoSource(item.photo_base64):"";body+=`<section class="learner-photo-section" aria-labelledby="learner-photo-label"><div class="field"><label id="learner-photo-label" for="f-learner-photo">Learner Photo</label><input id="f-learner-photo" type="file" accept="image/*" aria-describedby="learner-photo-help learner-photo-error"><span class="field-hint" id="learner-photo-help">Choose an image no larger than 2 MB. Selecting a new photo replaces the current one.</span><div class="learner-photo-preview" id="learner-photo-preview">${photo?`<img src="${esc(photo)}" alt="${esc(item.full_name||"Learner")} photo preview">`:"<span>Photo preview</span>"}</div><p class="learner-photo-error" id="learner-photo-error" role="alert" aria-live="polite"></p></div></section>`}
     if(m.type==="subject"){const selectedCategory=item.category||m.category||"CORE";title=editing?"Edit subject":"Add a subject";endpoint=editing?`/api/subjects/${encodeURIComponent(item.id)}`:"/api/subjects";body=`<div class="form-two"><div class="field wide"><label for="f-name">Subject or activity name *</label><input id="f-name" name="name" required maxlength="160" value="${esc(item.name||"")}"></div><div class="field"><label for="f-level">Level *</label><select id="f-level" name="level" required>${levelOptions(item.level)}</select></div><div class="field"><label for="f-category">Report-card section *</label><select id="f-category" name="category" required><option value="CORE" ${selectedCategory==="CORE"?"selected":""}>Core subject table</option><option value="OTHER" ${selectedCategory==="OTHER"?"selected":""}>Other subjects / co-curricular</option></select><span class="field-hint">Other subjects appear in the dedicated co-curricular section, not in the core average.</span></div><div class="field"><label for="f-code">Subject code</label><input id="f-code" name="code" maxlength="40" value="${esc(item.code||"")}"></div><div class="field"><label for="f-papers">Papers</label><input id="f-papers" name="papers" type="number" min="1" max="10" value="${esc(item.papers||1)}"></div><div class="field"><label for="f-sort_order">Display order</label><input id="f-sort_order" name="sort_order" type="number" min="0" step="1" value="${esc(item.sort_order??0)}"></div><div class="field"><label class="watermark-toggle" for="f-is_compulsory"><input id="f-is_compulsory" name="is_compulsory" type="checkbox" value="true" ${item.is_compulsory===true?"checked":""}><span><strong>Compulsory subject</strong><small>Show a visible asterisk in marks entry and the catalogue.</small></span></label></div></div>`}
     if(m.type==="grade"){title=editing?"Edit grade":"Add a grade";endpoint=editing?`/api/grading/${encodeURIComponent(item.id)}`:"/api/grading";body=`<div class="form-two"><div class="field"><label for="f-level">Level *</label><select id="f-level" name="level" required>${levelOptions(item.level)}</select></div><div class="field"><label for="f-grade_code">Grade code *</label><input id="f-grade_code" name="grade_code" required maxlength="30" value="${esc(item.grade_code||"")}"></div><div class="field"><label for="f-min_score">Minimum score *</label><input id="f-min_score" name="min_score" type="number" min="0" max="100" step=".01" required value="${esc(item.min_score??"")}"></div><div class="field"><label for="f-max_score">Maximum score *</label><input id="f-max_score" name="max_score" type="number" min="0" max="100" step=".01" required value="${esc(item.max_score??"")}"></div><div class="field"><label for="f-points">Points <span class="field-hint">(optional)</span></label><input id="f-points" name="points" type="number" min="0" max="1000" step=".01" value="${esc(item.points??"")}"></div><div class="field"><label for="f-sort_order">Display order</label><input id="f-sort_order" name="sort_order" type="number" min="0" step="1" value="${esc(item.sort_order??0)}"></div><div class="field wide"><label for="f-descriptor">Descriptor</label><input id="f-descriptor" name="descriptor" maxlength="200" value="${esc(item.descriptor||"")}"></div><div class="field wide"><label for="f-comment">Dropdown remark</label><textarea id="f-comment" name="comment" maxlength="1000">${esc(item.comment||"")}</textarea></div></div>`}
     if(m.type==="grading-scale"){
       title="Create a custom grading scale";
       endpoint="/api/grading/scales";
       const rows=m.rows?.length?m.rows:[
         {grade_code:"A",min_score:80,max_score:100,points:"",descriptor:"",comment:""},
         {grade_code:"B",min_score:70,max_score:79,points:"",descriptor:"",comment:""},
         {grade_code:"C",min_score:60,max_score:69,points:"",descriptor:"",comment:""},
         {grade_code:"D",min_score:50,max_score:59,points:"",descriptor:"",comment:""},
         {grade_code:"E",min_score:0,max_score:49,points:"",descriptor:"",comment:""},
       ];
       body=`<div class="form-two"><div class="field"><label for="f-level">Level *</label><select id="f-level" name="level" required>${levelOptions(m.level||state.filter.level||"PRIMARY")}</select></div><div class="field"><label for="f-name">Scale name *</label><input id="f-name" name="name" required maxlength="100" placeholder="e.g. School 2026 scale"></div></div><p class="field-hint">Score bands must be between 0 and 100 and cannot overlap. Existing scales are kept when you create or activate another one.</p><div class="table-wrap custom-scale-table"><table><thead><tr><th>Grade</th><th>Min</th><th>Max</th><th>Points</th><th>Descriptor</th><th>Dropdown remark</th><th></th></tr></thead><tbody id="custom-scale-rows">${rows.map((row,index)=>`<tr data-custom-scale-row><td><input name="scale_grade_code" required maxlength="30" aria-label="Grade code ${index+1}" value="${esc(row.grade_code||"")}"></td><td><input name="scale_min_score" required type="number" min="0" max="100" step=".01" aria-label="Minimum score ${index+1}" value="${esc(row.min_score??"")}"></td><td><input name="scale_max_score" required type="number" min="0" max="100" step=".01" aria-label="Maximum score ${index+1}" value="${esc(row.max_score??"")}"></td><td><input name="scale_points" type="number" min="0" max="1000" step=".01" aria-label="Points ${index+1}" value="${esc(row.points??"")}"></td><td><input name="scale_descriptor" maxlength="200" aria-label="Descriptor ${index+1}" value="${esc(row.descriptor||"")}"></td><td><input name="scale_comment" maxlength="1000" aria-label="Dropdown remark ${index+1}" value="${esc(row.comment||"")}"></td><td><button class="icon-btn delete" type="button" aria-label="Remove grade row" data-action="remove-custom-grade-row">${icon("fa-trash")}</button></td></tr>`).join("")}</tbody></table></div><button class="btn btn-quiet" type="button" data-action="add-custom-grade-row">${icon("fa-plus")} Add grade row</button>`;
     }
      if(m.type==="primary-subject-bands"){
        method="PUT";
        title="Edit Primary subject bands";
        const subjects=(state.data.subjects||[]).filter(subject=>subject.level==="PRIMARY"&&subject.category!=="OTHER");
        const selectedSubject=subjects.find(subject=>String(subject.id)===String(m.subjectId))||subjects[0];
        const subjectId=selectedSubject?.id||"";
        const configured=(state.data.subjectGrading||[]).filter(row=>String(row.subject_id)===String(subjectId));
        const fallback=(state.data.grading||[]).filter(row=>row.level==="PRIMARY");
        const rows=configured.length?configured:fallback;
        endpoint=`/api/grading/scales/${encodeURIComponent(m.scaleId)}/subjects/${encodeURIComponent(subjectId)}`;
        body=`<div class="field"><label for="ple-subject">Subject *</label><select id="ple-subject" name="subject_id" data-ple-subject required>${subjects.map(subject=>`<option value="${esc(subject.id)}" ${String(subject.id)===String(subjectId)?"selected":""}>${esc(subject.name)}</option>`).join("")}</select></div><p class="field-hint">These score bands apply only to this subject for Primary classes. Leave points at the PLE values (D1=1 through F9=9) unless the school uses another aggregate convention.</p><div class="table-wrap custom-scale-table"><table><thead><tr><th>Grade</th><th>Min</th><th>Max</th><th>Points</th><th>Descriptor</th></tr></thead><tbody>${rows.map((row,index)=>`<tr data-ple-grade-row><td><input name="ple_grade_code" required maxlength="30" aria-label="Grade code ${index+1}" value="${esc(row.grade_code||"")}"></td><td><input name="ple_min_score" required type="number" min="0" max="100" step=".01" aria-label="Minimum score ${index+1}" value="${esc(row.min_score??"")}"></td><td><input name="ple_max_score" required type="number" min="0" max="100" step=".01" aria-label="Maximum score ${index+1}" value="${esc(row.max_score??"")}"></td><td><input name="ple_points" type="number" min="0" max="1000" step=".01" aria-label="Aggregate points ${index+1}" value="${esc(row.points??"")}"></td><td><input name="ple_descriptor" maxlength="200" aria-label="Descriptor ${index+1}" value="${esc(row.descriptor||"")}"></td></tr>`).join("")}</tbody></table></div>`;
      }
     if(m.type==="teacher"){title=editing?"Edit teacher":"Add a teacher";endpoint=editing?`/api/teachers/${encodeURIComponent(item.id)}`:"/api/teachers";body=`<div class="form-two"><div class="field wide"><label for="f-name">Teacher name *</label><input id="f-name" name="name" required maxlength="200" value="${esc(item.name||"")}"></div><div class="field"><label for="f-email">Email *</label><input id="f-email" name="email" type="email" required maxlength="254" value="${esc(item.email||"")}"></div><div class="field"><label for="f-phone">Phone</label><input id="f-phone" name="phone" type="tel" maxlength="60" value="${esc(item.phone||"")}"></div><div class="field wide"><label for="f-teacher_type">Teacher type</label><select id="f-teacher_type" name="teacher_type"><option value="regular" ${!item.teacher_type||item.teacher_type==="regular"?"selected":""}>Regular teacher</option><option value="class_teacher" ${item.teacher_type==="class_teacher"?"selected":""}>Class teacher</option></select></div></div>`}
    if(m.type==="assignment"){title="Assign teacher";endpoint="";body=`<input type="hidden" name="teacher_id" value="${esc(m.teacherId)}"><div class="form-grid"><div class="field"><label for="f-class_id">Class *</label><select id="f-class_id" name="class_id" required>${classOptions("",false)}</select></div><div class="field"><label for="f-subject_id">Subject *</label><select id="f-subject_id" name="subject_id" required><option value="">Choose a subject</option>${(state.data.subjects||[]).map(s=>`<option value="${esc(s.id)}">${esc(s.name)} · ${esc(levelLabel(s.level))}</option>`).join("")}</select></div></div>`}
    return `<div class="modal-backdrop" data-action="backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">${title}</h2><p>Fields marked * are required.</p></div><button class="close-btn" data-action="close-modal" aria-label="Close">${icon("fa-xmark")}</button></div><div id="modal-error"></div><form id="modal-form" data-type="${m.type}" data-endpoint="${esc(endpoint)}" data-method="${method}" novalidate>${body}<div class="modal-actions"><button class="btn btn-outline" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">${editing?"Save changes":m.type==="assignment"?"Assign":"Save"}</button></div></form></section></div>`;
  }
  const standardModalMarkup=modalMarkup;
  modalMarkup=function(){
    const modal=state.modal;
    if(modal?.type!=="mark-comment-choice")return standardModalMarkup();
    const options=state.role==="teacher"
      ?(state.rm.commentOptions||[])
      :[...new Set((state.data.grading||[]).map(grade=>String(grade.comment||"").trim()).filter(Boolean))];
    const promptText=modal.pending==="teacher-submit"
      ?"Choose the comment method before submitting marks for review."
      :modal.pending==="comment-only"
        ?"Choose Auto, Dropdown, or Custom for this learner’s report-card comment."
        :"Choose the comment method before saving marks.";
    const title=modal.pending==="teacher-submit"
      ?"Choose comments before submission"
      :modal.learnerName?`Comment for ${esc(modal.learnerName)}`:"Choose how to handle comments";
    return `<div class="modal-backdrop" data-action="backdrop"><section class="modal comment-choice-modal" role="dialog" aria-modal="true" aria-labelledby="comment-choice-title"><div class="modal-head"><div><h2 id="comment-choice-title">${title}</h2><p>${promptText}</p></div><button class="close-btn" data-action="close-modal" aria-label="Close">${icon("fa-xmark")}</button></div><fieldset class="comment-choice-options"><legend>Comment method</legend><label><input type="radio" name="comment-choice" value="auto" checked> Auto-generate each comment from the learner’s grade</label><label><input type="radio" name="comment-choice" value="saved" ${options.length?"":"disabled"}> Dropdown — choose a saved grading comment</label><label><input type="radio" name="comment-choice" value="custom"> Custom — write a comment</label></fieldset><div class="field" data-comment-mode-panel="saved" hidden><label for="saved-comment-choice">Saved comment</label><select id="saved-comment-choice" data-has-options="${options.length>0}" disabled><option value="">Choose a saved comment</option>${options.map(option=>`<option value="${esc(option)}">${esc(option)}</option>`).join("")}</select>${options.length?"":'<span class="field-hint">No saved grading comments are configured yet. Add them under Grading.</span>'}</div><div class="field" data-comment-mode-panel="custom" hidden><label for="custom-comment-choice">Custom comment</label><textarea id="custom-comment-choice" maxlength="1500" placeholder="Write the comment to apply" disabled>${esc(modal.customComment||"")}</textarea></div><div class="modal-actions"><button class="btn btn-outline" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="apply-mark-comment-choice">${icon("fa-floppy-disk")} Continue</button></div></section></div>`;
  };
  function formValues(form){
    const fd=new FormData(form), out={};
    for(const [key,raw] of fd.entries()){
      const value=String(raw).trim();
      if(["age","papers","sort_order","min_score","max_score","points","score","out_of","year"].includes(key))out[key]=value===""?null:Number(value);
      else out[key]=value;
    }
    return out;
  }
  function readImageDataUrl(file){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onerror=()=>reject(new Error("Could not read the selected photo."));
      reader.onload=()=>{
        const image=new Image();
        image.onerror=()=>reject(new Error("This image could not be opened. Try a JPG or PNG photo."));
        image.onload=()=>{
          const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight));
          const canvas=document.createElement("canvas");
          canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
          canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
          const context=canvas.getContext("2d");
          if(!context){reject(new Error("Photo preview is unavailable in this browser."));return}
          context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);
          context.drawImage(image,0,0,canvas.width,canvas.height);
          resolve(canvas.toDataURL("image/jpeg",0.88));
        };
        image.src=String(reader.result||"");
      };
      reader.readAsDataURL(file);
    });
  }
  function compressNurseryActivityIcon(file){
    if(!file?.type?.startsWith("image/"))return Promise.reject(new Error("Choose an image file for this activity."));
    if(file.size>10*1024*1024)return Promise.reject(new Error("Choose an image smaller than 10 MB."));
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onerror=()=>reject(new Error("Could not read the selected image."));
      reader.onload=()=>{
        const image=new Image();
        image.onerror=()=>reject(new Error("This image could not be opened."));
        image.onload=()=>{
          const canvas=document.createElement("canvas");
          canvas.width=50;canvas.height=50;
          const context=canvas.getContext("2d");
          if(!context){reject(new Error("Image processing is unavailable in this browser."));return}
          context.clearRect(0,0,50,50);
          const scale=Math.min(50/image.naturalWidth,50/image.naturalHeight);
          const width=image.naturalWidth*scale,height=image.naturalHeight*scale;
          context.drawImage(image,(50-width)/2,(50-height)/2,width,height);
          const result=canvas.toDataURL("image/png");
          if(result.length>65536){reject(new Error("The resized icon is too large to save."));return}
          resolve(result);
        };
        image.src=String(reader.result||"");
      };
      reader.readAsDataURL(file);
    });
  }
  async function handleLearnerPhotoSelection(input){
    const file=input.files?.[0];if(!file)return;
    const error=document.getElementById("learner-photo-error");
    const showError=message=>{if(error)error.textContent=message};
    if(file.type&&!file.type.startsWith("image/")){input.value="";showError("Choose an image file.");return}
    if(file.size>MAX_LEARNER_PHOTO_BYTES){input.value="";showError("Photo must be 2 MB or smaller. The current photo will be kept.");return}
    input.dataset.processing="true";input.dataset.ready="false";
    try{
      const photo=await readImageDataUrl(file);
      const payload=photo.slice(photo.indexOf(",")+1);
      const padding=payload.endsWith("==")?2:payload.endsWith("=")?1:0;
      if(Math.floor(payload.length*3/4)-padding>MAX_LEARNER_PHOTO_BYTES)throw new Error("The converted photo is too large. Choose a smaller image.");
      input.dataset.photoBase64=photo;input.dataset.ready="true";
      const preview=document.getElementById("learner-photo-preview");
      if(preview)preview.innerHTML=`<img src="${esc(photo)}" alt="Selected learner photo preview">`;
      showError("");
    }catch(err){showError(err.message||"Could not prepare this photo.");input.value="";input.dataset.ready="false"}
    finally{input.dataset.processing="false"}
  }
  async function handleModalSubmit(form){
    const values=formValues(form), type=form.dataset.type, method=form.dataset.method;
    if(type==="learner"){
      const admissionInput=form.querySelector('[name="reg_no"]');
      if(admissionInput)admissionInput.required=state.data.schoolSettings?.admission_number_mode!=="auto";
    }
    if(!form.reportValidity())return;
    if(type==="learner"){
      const photoInput=form.querySelector("#f-learner-photo");
      if(photoInput?.dataset.processing==="true"){document.getElementById("learner-photo-error").textContent="Wait for the photo preview to finish before saving.";return}
      if(photoInput?.files?.length&&photoInput.dataset.ready!=="true"){document.getElementById("learner-photo-error").textContent="Select a valid photo before saving.";return}
      if(photoInput?.dataset.photoBase64)values.photo_base64=photoInput.dataset.photoBase64;
    }
    if(type==="subject")values.is_compulsory=form.querySelector('[name="is_compulsory"]')?.checked===true;
    if(type==="grading-scale"){
      values.rows=[...form.querySelectorAll("[data-custom-scale-row]")].map((row,index)=>({
        grade_code:row.querySelector('[name="scale_grade_code"]').value.trim(),
        min_score:Number(row.querySelector('[name="scale_min_score"]').value),
        max_score:Number(row.querySelector('[name="scale_max_score"]').value),
        points:row.querySelector('[name="scale_points"]').value===""?null:Number(row.querySelector('[name="scale_points"]').value),
        descriptor:row.querySelector('[name="scale_descriptor"]').value.trim()||null,
        comment:row.querySelector('[name="scale_comment"]').value.trim()||null,
        sort_order:index
      }));
    }
    if(type==="primary-subject-bands"){
      values.rows=[...form.querySelectorAll("[data-ple-grade-row]")].map((row,index)=>({
        grade_code:row.querySelector('[name="ple_grade_code"]').value.trim(),
        min_score:Number(row.querySelector('[name="ple_min_score"]').value),
        max_score:Number(row.querySelector('[name="ple_max_score"]').value),
        points:row.querySelector('[name="ple_points"]').value===""?null:Number(row.querySelector('[name="ple_points"]').value),
        descriptor:row.querySelector('[name="ple_descriptor"]').value.trim()||null,
        comment:null,
        sort_order:index
      }));
      if(!values.rows.length||values.rows.some(row=>!row.grade_code||row.min_score>row.max_score)){
        document.getElementById("modal-error").innerHTML='<div class="alert error">Enter valid subject grade bands before saving.</div>';return
      }
      delete values.subject_id;
    }
    if(type==="grade"&&values.min_score>values.max_score){document.getElementById("modal-error").innerHTML='<div class="alert error">Minimum score cannot exceed maximum score.</div>';return}
    if(type==="grading-scale"&&values.rows.length<1){document.getElementById("modal-error").innerHTML='<div class="alert error">Add at least one grade row.</div>';return}
    if(type==="change-password"&&values.new_password!==values.confirm_password){document.getElementById("modal-error").innerHTML='<div class="alert error">The new passwords do not match.</div>';return}
    if(type==="change-password")delete values.confirm_password;
    const submit=form.querySelector('[type="submit"]');submit.disabled=true;submit.textContent="Saving…";
    try{
      const endpoint=type==="project"&&method==="POST"
        ?`/api/learners/${encodeURIComponent(values.learner_id||"")}/projects`
        :form.dataset.endpoint;
      if(type==="project")delete values.learner_id;
      const result=type==="assignment"?await api("/api/rm/assignments",{method:"POST",body:{teacher_id:values.teacher_id,class_id:values.class_id,subject_id:values.subject_id}}):await api(endpoint,{method,body:values});
      if(type==="change-password"){state.mustChangePassword=false;state.modal=null;await loadRoute(state.route);toast("Password changed.");return}
      if(type==="teacher"&&result.initial_password){state.modal={type:"password-success",password:String(result.initial_password)};await loadRoute("teachers");render();return}
      if(type==="teacher"){state.modal=null;toast("Teacher details saved.");await loadRoute("teachers");return}
      if(type==="assignment"){toast("Teacher assignment added.");await loadRoute("teachers");return}
      if(type==="project"){state.modal=null;toast(method==="PATCH"?"Project changes saved.":"Project added.");if(state.route==="projects")await loadProjectRegister();else await loadReportClass();return}
      if(type==="primary-subject-bands"){state.modal=null;toast("Subject grade bands saved.");await loadRoute(state.route);return}
        if(type==="learner")state.modal=null;
        const learnerCreated=type==="learner"&&method==="POST"&&result.learner?.reg_no;
        toast(learnerCreated?`Learner added with admission number ${result.learner.reg_no}.`:method==="PATCH"?"Changes saved.":"Record added.");await loadRoute(state.route);
    }catch(error){const err=document.getElementById("modal-error");if(err)err.innerHTML=`<div class="alert error" role="alert">${esc(error.message)}</div>`;submit.disabled=false;submit.textContent=method==="PATCH"?"Save changes":type==="assignment"?"Assign":"Save"}
  }
  function parseCsv(text){
    const rows=[];let row=[],field="",quoted=false;
    for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++}else if(c==='"')quoted=false;else field+=c}else if(c==='"'){quoted=true}else if(c===","){row.push(field);field=""}else if(c==="\n"||c==="\r"){if(c==="\r"&&text[i+1]==="\n")i++;row.push(field);if(row.some(v=>v.trim()!==""))rows.push(row);row=[];field=""}else field+=c}
    if(quoted)throw new Error("CSV has an unclosed quoted field.");row.push(field);if(row.some(v=>v.trim()!==""))rows.push(row);if(rows.length<2)throw new Error("CSV must include a header row and at least one learner.");
    const headers=rows.shift().map(h=>h.replace(/^\uFEFF/,"").trim().toLowerCase());if(!headers.includes("full_name"))throw new Error("CSV requires a full_name column. A reg_no column is optional when automatic admission numbering is enabled.");
    const allowed=["reg_no","full_name","gender","age","house","parent_name","parent_phone","parent_email"];
    const errors=[];const parsed=rows.map((cells,i)=>{const obj={};headers.forEach((h,index)=>{if(allowed.includes(h))obj[h]=(cells[index]||"").trim()});if(!obj.full_name){errors.push({row:i+2,error:"full_name is required"});return null}if(obj.age)obj.age=Number(obj.age);else delete obj.age;return {sourceRow:i+2,data:obj}}).filter(Boolean);
    return {rows:parsed,errors}
  }
  async function importCsv(file){
    if(!state.filter.class_id){toast("Choose a class filter before importing a CSV.", "error");return}
    try{const parsed=parseCsv(await file.text());if(!parsed.rows.length){state.modal={type:"import-result",created:0,errors:parsed.errors};render();return}const result=await api("/api/learners/bulk",{method:"POST",body:{class_id:state.filter.class_id,rows:parsed.rows.map(x=>x.data)}});const sourceRows=parsed.rows.map(x=>x.sourceRow);const apiErrors=(result.errors||[]).map(e=>({...e,row:sourceRows[Number(e.row)-1]||e.row}));state.modal={type:"import-result",created:(result.created||[]).length,errors:[...parsed.errors,...apiErrors]};await loadRoute("learners");render()}
    catch(error){toast(error.message,"error")}
  }
  async function deleteRecord(type,id){
     const configs={class:["/api/classes/","class"],learner:["/api/learners/","learner"],subject:["/api/subjects/","subject"],grade:["/api/grading/","grade"]};
    const [path,label]=configs[type];if(!confirm(`Delete this ${label}? This action cannot be undone.`))return;
     const row=type==="grade"?rowFrom("grade",id):null;
     const suffix=type==="grade"&&row?.level?`?level=${encodeURIComponent(row.level)}`:"";
     try{await api(path+encodeURIComponent(id)+suffix,{method:"DELETE"});toast(`${label[0].toUpperCase()+label.slice(1)} deleted.`);await loadRoute(state.route)}catch(e){toast(e.message,"error")}
  }
  async function openLearnerProfile(id){
    state.modal={type:"learner-profile",loading:true};render();
    try{const result=await api(`/api/learners/${encodeURIComponent(id)}`);state.modal={type:"learner-profile",learner:result.learner};render()}
    catch(error){state.modal={type:"learner-profile",error:error.message};render()}
  }
  async function editLearner(id){
    try{const result=await api(`/api/learners/${encodeURIComponent(id)}`);state.modal={type:"learner",item:result.learner};render()}
    catch(error){toast(`Could not load learner for editing: ${error.message}`,"error")}
  }
  async function deleteProject(id){
    if(!confirm("Delete this project? This action cannot be undone."))return;
    try{await api(`/api/projects/${encodeURIComponent(id)}`,{method:"DELETE"});toast("Project deleted.");if(state.route==="projects")await loadProjectRegister();else await loadReportClass()}
    catch(error){toast(error.message,"error")}
  }
  function rowFrom(type,id){const map={class:"classes",learner:"learners",subject:"subjects",grade:"grading"};return (state.data[map[type]]||[]).find(x=>String(x.id)===String(id))}
  function financeToast(message,kind="success"){toast(message,kind)}
  async function financeAction(button){
    const action=button.dataset.finAction,id=button.dataset.id,f=state.finance;
    if(await window.ReportCardsFinance?.handleAction?.(action,state,api,financeToast))return;
    if(action==="refresh"){await loadFinanceTab();render();return}
    if(action==="record-payment"||action==="add-expense"){
      f.tab=action==="record-payment"?"income":"expenses";await loadRoute("finance");
      document.getElementById(action==="record-payment"?"payment-form-card":"expense-form-card")?.setAttribute("open","");
      document.getElementById(action==="record-payment"?"payment-form-card":"expense-form-card")?.scrollIntoView({behavior:"smooth",block:"center"});
      return;
    }
    if(action==="filter-income"){
      const value=(selector)=>document.querySelector(selector)?.value||"";
      f.incomeFilters={class_id:value('[data-fin-income-filter="class_id"]'),method:value('[data-fin-income-filter="method"]'),from:value('[data-fin-income-filter="from"]'),to:value('[data-fin-income-filter="to"]')};
      await loadRoute("finance");return;
    }
    if(action==="filter-expenses"){
      f.expenseFilters={category:document.querySelector('[data-fin-expense-filter="category"]')?.value||"",status:document.querySelector('[data-fin-expense-filter="status"]')?.value||""};
      await loadRoute("finance");return;
    }
    if(action==="filter-schoolpay"){
      f.schoolpayFilters={status:document.querySelector('[data-fin-schoolpay-filter="status"]')?.value||""};
      await loadRoute("finance");return;
    }
    if(action==="reconcile"){
      button.disabled=true;
      try{const result=await api("/api/fin/schoolpay/reconcile",{method:"POST",body:{}});financeToast(`Checked ${result.examined} transactions; matched ${result.matched}.`);await loadRoute("finance")}
      catch(error){financeToast(error.message,"error")}finally{button.disabled=false}
      return;
    }
    if(action==="match-transaction"){
      const learnerId=document.querySelector(`[data-fin-match-id="${CSS.escape(id)}"]`)?.value;
      if(!learnerId){financeToast("Select a learner before matching.","error");return}
      try{await api(`/api/fin/schoolpay/transactions/${encodeURIComponent(id)}/match`,{method:"POST",body:{learner_id:learnerId}});financeToast("Transaction matched and fees updated.");await loadRoute("finance")}
      catch(error){financeToast(error.message,"error")}return;
    }
    if(action==="approve-expense"){
      try{await api(`/api/fin/expenses/${encodeURIComponent(id)}/approve`,{method:"POST",body:{}});financeToast("Expense approved.");await loadRoute("finance")}
      catch(error){financeToast(error.message,"error")}return;
    }
    if(action==="reject-expense"){
      const reason=prompt("Reason for rejecting this expense:");
      if(!reason?.trim())return;
      try{await api(`/api/fin/expenses/${encodeURIComponent(id)}/reject`,{method:"POST",body:{reason:reason.trim()}});financeToast("Expense rejected.");await loadRoute("finance")}
      catch(error){financeToast(error.message,"error")}return;
    }
    if(action==="delete-income"||action==="delete-expense"||action==="delete-budget"||action==="delete-fee-structure"){
      const entity=action==="delete-income"?"income":action==="delete-expense"?"expense":action==="delete-budget"?"budget row":"fee structure";
      if(!confirm(`Delete this ${entity}? This cannot be undone.`))return;
      const path=action==="delete-income"?`/api/fin/income/${encodeURIComponent(id)}`:action==="delete-expense"?`/api/fin/expenses/${encodeURIComponent(id)}`:action==="delete-budget"?`/api/fin/budget/${encodeURIComponent(id)}`:`/api/fin/fee-structure/${encodeURIComponent(id)}`;
      try{await api(path,{method:"DELETE"});financeToast(`${entity[0].toUpperCase()+entity.slice(1)} deleted.`);await loadRoute("finance")}
      catch(error){financeToast(error.message,"error")}return;
    }
    if(action==="save-role"){
      const financeRole=document.querySelector(`[data-fin-role-user="${CSS.escape(id)}"]`)?.value||null;
      try{await api("/api/fin/roles",{method:"POST",body:{user_id:id,finance_role:financeRole}});financeToast(financeRole?"Finance role assigned.":"Finance role removed.");await loadRoute("finance")}
      catch(error){financeToast(error.message,"error")}return;
    }
    if(action==="import-csv"){document.getElementById("finance-csv")?.click();return}
    if(action.startsWith("export-")){
      const csv=window.ReportCardsFinance?.csv;
      if(!csv)return;
      const reports=f.data.reports||{};
      if(action==="export-income")csv([["Date","Learner","Registration number","Class","Amount","Method","Purpose","Reference","Received by"],...(f.data.income||[]).map((x)=>[x.received_at,x.learner_name,x.reg_no,x.class_name,x.amount,x.payment_method,x.purpose,x.schoolpay_reference,x.received_by_label])],"income.csv");
      else if(action==="export-income-template")csv([["reg_no","amount","payment_method","purpose","term","year","notes","schoolpay_reference"]],"income-import-template.csv");
      else if(action==="export-report-learners")csv([["Learner","Registration number","Class","Total fees","Paid","Balance"],...(reports.byLearner||[]).map((x)=>[x.full_name,x.reg_no,x.class_name,x.total_fees,x.paid,x.balance])],"finance-by-learner.csv");
      else if(action==="export-class")csv([["Class","Income","Expenses","Net"],...(reports.byClass||[]).map((x)=>[x.class_name,x.income,x.expenses,x.net])],"finance-by-class.csv");
      else if(action==="export-category")csv([["Category","Approved expenses"],...(reports.byCategory||[]).map((x)=>[x.category,x.amount])],"finance-by-category.csv");
      else if(action==="export-budget")csv([["Category","Budgeted","Actual","Variance"],...(reports.budgetVsActual||[]).map((x)=>[x.category,x.budgeted_amount,x.actual,x.variance])],"budget-vs-actual.csv");
      else if(action==="export-outstanding")csv([["Learner","Registration number","Class","Total fees","Paid","Balance"],...(reports.outstanding||[]).map((x)=>[x.learner,x.reg_no,x.class,x.total_fees,x.paid,x.balance])],"outstanding-fees.csv");
      return;
    }
  }
  function parseFinanceCsv(text){
    const rows=[];let row=[],field="",quoted=false;
    for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++}else if(c==='"')quoted=false;else field+=c}else if(c==='"')quoted=true;else if(c===","){row.push(field);field=""}else if(c==="\n"||c==="\r"){if(c==="\r"&&text[i+1]==="\n")i++;row.push(field);if(row.some(v=>v.trim()))rows.push(row);row=[];field=""}else field+=c}
    if(quoted)throw new Error("CSV has an unclosed quoted field.");row.push(field);if(row.some(v=>v.trim()))rows.push(row);
    if(rows.length<2)throw new Error("CSV must contain a header and at least one payment.");
    const headers=rows.shift().map(h=>h.replace(/^\uFEFF/,"").trim().toLowerCase());
    for(const key of ["reg_no","amount","payment_method","term","year"])if(!headers.includes(key))throw new Error(`CSV is missing required column: ${key}`);
    if(rows.length>200)throw new Error("Import no more than 200 payments at a time.");
    return rows.map((cells)=>Object.fromEntries(headers.map((header,index)=>[header,(cells[index]||"").trim()])));
  }
  async function importFinanceCsv(file){
    try{
      const rows=parseFinanceCsv(await file.text()).map((row)=>({...row,amount:Number(row.amount),year:Number(row.year),purpose:row.purpose||"fees"}));
      const result=await api("/api/fin/income/bulk",{method:"POST",body:{rows}});
      state.modal={type:"finance-import-result",created:result.created?.length||0,errors:result.errors||[]};
      await loadRoute("finance");render();
    }catch(error){financeToast(error.message,"error")}
    finally{const input=document.getElementById("finance-csv");if(input)input.value=""}
  }
  async function handleFinanceSubmit(form){
    if(!form.reportValidity())return;
    const type=form.dataset.finForm,fd=new FormData(form),body={};
    for(const [key,raw] of fd.entries()){
      if(key.startsWith("clear_"))continue;
      const value=String(raw).trim();
      if(["amount","year","total_fees","budgeted_amount","expense_approval_threshold"].includes(key))body[key]=value===""?null:Number(value);
      else if(key==="breakdown"){if(value){try{body.breakdown=JSON.parse(value)}catch{financeToast("Breakdown must be valid JSON.","error");return}}}
      else body[key]=value;
    }
    if(type==="expense"||type==="fee-structure")if(!body.class_id)body.class_id=null;
    if(type==="settings"){
      if(fd.has("clear_consumer_key"))body.schoolpay_consumer_key=null;
      if(fd.has("clear_consumer_secret"))body.schoolpay_consumer_secret=null;
    }
    const endpoints={payment:["/api/fin/income","POST"],expense:["/api/fin/expenses","POST"],"fee-structure":["/api/fin/fee-structure","POST"],budget:["/api/fin/budget","POST"],settings:["/api/fin/settings","PATCH"]};
    const [path,method]=endpoints[type]||[];
    if(!path){financeToast("Unknown finance form.","error");return}
    const submit=form.querySelector('[type="submit"]');if(submit){submit.disabled=true;submit.textContent="Saving…"}
    try{await api(path,{method,body});financeToast(type==="payment"?"Payment recorded and learner balance updated.":type==="expense"?"Expense recorded.":type==="settings"?"Finance settings saved.":"Finance record saved.");await loadRoute("finance")}
    catch(error){financeToast(error.message,"error");if(submit){submit.disabled=false;submit.textContent="Save"}}
  }
   function collectMarkRows(tableId){return [...document.querySelectorAll(`#${tableId} tbody tr[data-learner]`)].map(tr=>{const values={};tr.querySelectorAll("[data-score],[data-mark-period-score]").forEach(input=>{const key=input.dataset.markPeriodScore||input.dataset.score;values[key]=input.value===""?null:Number(input.value)});const trMode=tr.querySelector("[data-tr-mode]")?.value||"auto";const remark=tr.querySelector(`[data-tr-input="${trMode}"]`)?.value?.trim()||null;const pointType=tr.querySelector("[data-grade-point-type]"),overallInput=tr.querySelector("[data-overall-grade]");return {learner_id:tr.dataset.learner,...values,teacher_initials:tr.querySelector("[data-initials]")?.value.trim()||null,tr_mode:trMode,tr:trMode==="auto"?null:remark,...(overallInput?{overall_grade_code:overallInput.value||null,grade_point_type:pointType?.checked?"subsidiary":"principal"}:{})}})}
  function openMarkCommentFlow(pending,learnerId=""){
    const field=learnerId?document.querySelector(`[data-comment="${CSS.escape(learnerId)}"]`):null;
    const isTeacher=state.role==="teacher";
    const marks=isTeacher?(state.rm.marks||[]):(state.data.marks||[]);
    const tableId=isTeacher?"teacher-marks-table":"marks-table";
    const commentRows=document.getElementById(tableId)?collectMarkRows(tableId):[];
    const rows=pending==="comment-only"?[]:commentRows;
    const learnerIds=learnerId?[learnerId]:rows.length?rows.map(row=>row.learner_id):marks.map(row=>row.learner_id);
    if(!learnerIds.length){toast("Load a class with learners before saving marks or submitting comments.","error");return}
    state.modal={type:"mark-comment-choice",pending,rows,commentRows,learnerIds,learnerName:marks.find(row=>String(row.learner_id)===String(learnerId))?.full_name||"",customComment:field?.value||""};
    render();
  }
   function periodScoreFromRow(row){
     if(!row)return null;
     const scores=markEntryPeriod().fields.map(({key})=>row[key]).filter(value=>value!==null&&value!==undefined&&value!==""&&Number.isFinite(Number(value))).map(Number);
     return scores.length?scores.reduce((sum,value)=>sum+value,0)/scores.length:null;
   }
   function markRowHasUnsavedPeriodScore(row){
    if(!row)return false;
    const savedRows=state.role==="teacher"?(state.rm.marks||[]):(state.data.marks||[]);
    const saved=savedRows.find(item=>String(item.learner_id)===String(row.learner_id));
    return markEntryPeriod().fields.some(({key})=>{
      const current=row[key]===null||row[key]===undefined||row[key]===""?null:Number(row[key]);
      const previous=saved?.[key]===null||saved?.[key]===undefined||saved?.[key]===""?null:Number(saved[key]);
      return current!==previous;
    });
  }
  async function saveAutoComment(learnerId,modal){
    const commentRows=modal.commentRows||modal.rows||[];
    const baseBody={term:state.filter.term,year:Number(state.filter.academic_year),...(state.filter.subject_id?{subject_id:state.filter.subject_id}:{})};
      const marksSavedInThisFlow=["teacher-save","teacher-submit"].includes(modal.pending);
     const editedRow=commentRows.find(row=>String(row.learner_id)===String(learnerId));
     if(!marksSavedInThisFlow&&markRowHasUnsavedPeriodScore(editedRow)){
       throw new Error("Please save marks first, then generate the overall class teacher comment.");
    }
    try{
      await api(`/api/rm/cards/${encodeURIComponent(learnerId)}/class-teacher-comment`,{method:"POST",body:{...baseBody,comment_mode:"auto"}});
    }catch(error){
      if(/Enter marks for this learner before generating a grade-based comment/iu.test(error.message)){
         throw new Error("Please save marks first, then generate the overall class teacher comment.");
      }
      throw error;
    }
  }
  async function applyMarkCommentChoice(){
    const modal=state.modal;if(!modal)return;
    const mode=document.querySelector('input[name="comment-choice"]:checked')?.value||"auto";
    const comment=mode==="saved"?document.getElementById("saved-comment-choice")?.value||"":document.getElementById("custom-comment-choice")?.value.trim()||"";
    if(mode!=="auto"&&!comment){toast(mode==="saved"?"Choose a saved comment first.":"Enter a custom comment first.","error");return}
    state.modal=null;render();
    try{
      if(modal.pending==="teacher-save"||modal.pending==="teacher-submit"){
        if(!await saveTeacherMarks(false,modal.rows))return;
      }
      for(const learnerId of modal.learnerIds){
        if(mode==="auto")await saveAutoComment(learnerId,modal);
        else await api(`/api/rm/cards/${encodeURIComponent(learnerId)}/class-teacher-comment`,{method:"POST",body:{term:state.filter.term,year:Number(state.filter.academic_year),comment_mode:mode,comment,...(state.filter.subject_id?{subject_id:state.filter.subject_id}:{})}});
      }
      if(modal.pending==="comment-only"||modal.pending==="teacher-save"||modal.pending==="teacher-submit"){
        await loadTeacherMarks();
      }
      if(modal.pending==="teacher-submit"){
        await api(`/api/rm/class/${encodeURIComponent(state.filter.class_id)}/submit-for-review`,{method:"POST",body:{subject_id:state.filter.subject_id,term:state.filter.term,year:Number(state.filter.academic_year),assessment_period:markEntryPeriod().value}});
        await loadTeacherMarks();toast("Marks submitted for review.");
      }else if(modal.pending==="comment-only")toast("Comment saved.");
      else toast(modal.pending==="teacher-save"?"Marks and comments saved.":"Marks and comments saved.");
    }catch(error){toast(error.message||"Could not save the selected comments.","error")}
  }
  async function openAddLearner(){
    state.modal={type:"learner",admissionPreview:""};
    render();
    const automatic=(state.data.schoolSettings?.admission_number_mode||state.school?.admission_number_mode)==="auto";
    if(automatic){
      try{
        const result=await api("/api/learners/next-admission-number");
        if(state.modal?.type==="learner"){state.modal.admissionPreview=String(result.admission_number||"");render()}
      }catch(error){
        if(state.modal?.type==="learner"){
          const hint=root.querySelector("[data-admission-hint]");
          if(hint)hint.textContent=`Could not preview the next number: ${error.message}. Saving still assigns a unique number.`;
        }
      }
    }
    setTimeout(()=>document.querySelector(".modal input, .modal select")?.focus(),30);
  }
  async function action(button,clickEvent){
    const a=button.dataset.action,id=button.dataset.id;
    if(a==="settings-tab"){const tab=button.dataset.tab;if(["general","theme","grading","subjects","other","activity-icons","sms"].includes(tab)){state.data.settingsTab=tab;state.modal=null;render()}return}
    if(a==="command-center-tab"){const tab=button.dataset.tab;if(["schools","sms-bundles"].includes(tab)){state.data.commandCenterTab=tab;render()}return}
    if(a==="add-sms-bundle"){state.modal={type:"command-center-sms-bundle"};state.data.commandCenterTab="sms-bundles";render();setTimeout(()=>document.getElementById("cc-sms-bundle-name")?.focus(),20);return}
    if(a==="edit-sms-bundle"){const bundle=(state.data.commandCenterBundles||[]).find(item=>String(item.id)===String(id));if(bundle){state.modal={type:"command-center-sms-bundle",bundle};render();setTimeout(()=>document.getElementById("cc-sms-bundle-name")?.focus(),20)}return}
    if(a==="delete-sms-bundle"){const bundle=(state.data.commandCenterBundles||[]).find(item=>String(item.id)===String(id));if(!bundle||!window.confirm(`Delete the "${bundle.name}" SMS bundle?`))return;try{await api(`/api/command-center/sms-bundles/${encodeURIComponent(id)}`,{method:"DELETE"});state.data.commandCenterBundles=(state.data.commandCenterBundles||[]).filter(item=>String(item.id)!==String(id));render();toast("SMS bundle deleted.")}catch(error){toast(error.message||"Could not delete the SMS bundle.","error")}return}
    if(a==="buy-sms-bundle"){const bundle=(state.data.smsWallet?.bundles||[]).find(item=>String(item.id)===String(id));if(!bundle)return;if(state.data.smsWallet?.purchase_simulation_enabled!==true){toast("Bundle purchases are disabled in production. Contact the Super Admin for a manual credit top-up.","error");return}state.modal={type:"sms-bundle-purchase",bundle};render();return}
    if(a==="confirm-sms-bundle-purchase"){await confirmSmsBundlePurchase();return}
    if(a==="remove-activity-icon"){const activityName=button.dataset.name;if(!activityName)return;try{await api(`/api/school/activity-icons/${encodeURIComponent(activityName)}`,{method:"DELETE"});state.data.activityIcons=(state.data.activityIcons||[]).filter(item=>item.activity_name!==activityName);if(reportState.data?.school)reportState.data.school={...reportState.data.school,activity_icons:state.data.activityIcons};render();toast(`${activityName} now uses the default icon.`)}catch(error){state.data.activityIconError=error.message||"Could not restore the default icon.";render()}return}
     if(a==="refresh-command-center"){await loadRoute("command-center");return}
    if(a==="open-provision-modal"){if(state.role!=="super_admin")return;state.modal={type:"command-center-provision"};render();setTimeout(()=>document.getElementById("cc-school-name")?.focus(),20);return}
    if(a==="view-command-school"||a==="retry-command-school-details"){
      if(state.role!=="super_admin"||!id)return;
      const school=(state.data.commandCenter?.schools||[]).find(item=>String(item.id)===String(id));
      state.modal={type:"command-center-school",id,schoolName:school?.name||"",loading:true};render();
      try{const details=await api(`/api/super-admin/schools/${encodeURIComponent(id)}/details`);if(state.modal?.type!=="command-center-school"||String(state.modal.id)!==String(id))return;state.modal={...state.modal,details,loading:false}}
      catch(error){if(state.modal?.type!=="command-center-school"||String(state.modal.id)!==String(id))return;state.modal={...state.modal,error:error.message||"Could not load school details.",loading:false}}
      render();setTimeout(()=>root.querySelector(".modal [data-action='close-modal']")?.focus(),0);return
    }
    if(a==="toggle-password"){const input=document.getElementById(button.dataset.target);if(!input)return;const visible=input.type==="password";input.type=visible?"text":"password";button.setAttribute("aria-pressed",String(visible));button.setAttribute("aria-label",visible?"Hide password":"View password");button.innerHTML=icon(visible?"fa-eye-slash":"fa-eye");input.focus();return}
    if(a==="logout"){logout();return}
    if(a==="retry-report-verification"){await loadSelectedReportVerification();return}
    if(a==="preview-zoom-in"){reportState.zoom=Math.min(180,(Number(reportState.zoom)||100)+10);render();return}
    if(a==="preview-zoom-out"){reportState.zoom=Math.max(50,(Number(reportState.zoom)||100)-10);render();return}
    if(a==="preview-fullscreen"){reportState.fullscreen=true;render();return}
    if(a==="preview-close-fullscreen"){reportState.fullscreen=false;render();return}
    if(a==="print-report-learner"){await printReportCards(false);return}
    if(a==="print-report-class"){await printReportCards(true);return}
    if(a==="download-report-image"){await downloadReportImage();return}
    if(a==="menu"){document.querySelector(".sidebar")?.classList.add("open");if(!document.querySelector(".sidebar-scrim")){const s=document.createElement("div");s.className="sidebar-scrim";s.addEventListener("click",()=>{document.querySelector(".sidebar").classList.remove("open");s.remove()});root.append(s)}return}
    if(a==="close-modal"){state.modal=null;render();return}
    if(a==="backdrop"&&button===clickEvent.target){state.modal=null;render();return}
    if(a==="copy-password"){try{await navigator.clipboard.writeText(state.modal?.password||"");toast("Temporary password copied.")}catch{toast("Clipboard access is unavailable. Select and copy the password manually.","error")}return}
      if(a==="add-learner"){await openAddLearner();return}
      if(["add-class","add-learner","add-subject","add-grade","add-teacher"].includes(a)){const map={"add-class":"class","add-learner":"learner","add-subject":"subject","add-grade":"grade","add-teacher":"teacher"};state.modal={type:map[a],...(a==="add-subject"?{category:button.dataset.category||"CORE"}:{})};render();setTimeout(()=>document.querySelector(".modal input, .modal select")?.focus(),30);return}
     if(a==="create-grading-scale"){state.modal={type:"grading-scale",level:state.filter.level||"PRIMARY"};render();return}
      if(a==="edit-primary-subject-bands"){const level="PRIMARY",active=(state.data.activeGradingScales||[]).find(scale=>scale.level===level)||state.data.activeGradingScale,first=(state.data.subjects||[]).find(subject=>subject.level===level&&subject.category!=="OTHER");if(!active?.id||!first){toast("Activate a Primary grading scale and add Primary subjects first.","error");return}state.modal={type:"primary-subject-bands",scaleId:active.id,subjectId:first.id};render();return}
     if(a==="add-custom-grade-row"){const tbody=document.getElementById("custom-scale-rows");if(tbody){const index=tbody.querySelectorAll("[data-custom-scale-row]").length;tbody.insertAdjacentHTML("beforeend",`<tr data-custom-scale-row><td><input name="scale_grade_code" required maxlength="30" aria-label="Grade code ${index+1}"></td><td><input name="scale_min_score" required type="number" min="0" max="100" step=".01" aria-label="Minimum score ${index+1}"></td><td><input name="scale_max_score" required type="number" min="0" max="100" step=".01" aria-label="Maximum score ${index+1}"></td><td><input name="scale_points" type="number" min="0" max="1000" step=".01" aria-label="Points ${index+1}"></td><td><input name="scale_descriptor" maxlength="200" aria-label="Descriptor ${index+1}"></td><td><input name="scale_comment" maxlength="1000" aria-label="Dropdown remark ${index+1}"></td><td><button class="icon-btn delete" type="button" aria-label="Remove grade row" data-action="remove-custom-grade-row">${icon("fa-trash")}</button></td></tr>`)}return}
     if(a==="remove-custom-grade-row"){const rows=document.querySelectorAll("#custom-scale-rows [data-custom-scale-row]");if(rows.length>1)button.closest("[data-custom-scale-row]")?.remove();else toast("A custom scale needs at least one grade row.","error");return}
     if(a==="activate-grading-scale"){const select=document.getElementById("active-grading-scale"),scaleId=select?.value,scale=(state.data.gradingScales||[]).find(item=>String(item.id)===String(scaleId));if(!scaleId)return;try{await api(`/api/grading/scales/${encodeURIComponent(scaleId)}/activate`,{method:"POST",body:{}});state.filter.level=scale?.level||state.filter.level;toast("Grading scale activated.");await loadRoute(state.route)}catch(error){toast(error.message,"error")}return}
     if(a==="activate-grading-preset"){const level=state.filter.level||"A_LEVEL";try{await api("/api/grading/scales/preset",{method:"POST",body:{level,preset_key:button.dataset.preset}});state.filter.level=level;toast("Preset activated. Your other scales are preserved.");await loadRoute(state.route)}catch(error){toast(error.message,"error")}return}
     if(a==="view-learner"){await openLearnerProfile(id);return}
     if(a==="edit-learner"||a==="edit-profile-learner"){await editLearner(id);return}
    if(a==="invite-parent"){
      const learnerId=state.modal?.learner?.id||id;
      try{
        const result=await api("/api/parents/invite",{method:"POST",body:{learner_id:learnerId}});
        state.modal={type:"password-success",accountType:"parent",accountEmail:result.email,loginUrl:`${location.origin}/parent-dashboard.html`,password:String(result.temporary_password||"")};
        render();
        return;
      }catch(error){toast(error.message||"Could not invite this parent.","error");return}
    }
     if(["edit-class","edit-subject","edit-grade"].includes(a)){const type=a.split("-")[1];state.modal={type,item:rowFrom(type,id)};render();return}
    if(a==="add-project"){const learnerId=state.route==="projects"?"":reportState.learnerId;if(state.route==="projects"&&!(state.data.projectRegister?.learners||[]).length){toast("Load a class with active learners before adding a project.","error");return}if(state.route!=="projects"&&!learnerId)return;state.modal={type:"project",learnerId};render();setTimeout(()=>document.querySelector("#f-project_name")?.focus(),30);return}
    if(a==="edit-project"){const selected=reportState.data?.learners?.find(r=>String(r.learner.id)===String(reportState.learnerId));const item=(state.data.projectRegister?.projects||[]).find(project=>String(project.id)===String(id))||selected?.projects?.find(project=>String(project.id)===String(id));if(!item)return;state.modal={type:"project",item,learnerId:item.learner_id||reportState.learnerId};render();return}
    if(a==="delete-project"){await deleteProject(id);return}
    if(a.startsWith("delete-")){await deleteRecord(a.slice(7),id);return}
    if(a==="assign-teacher"){state.modal={type:"assignment",teacherId:id};render();return}
    if(a==="edit-teacher"){const item=(state.data.teachers||[]).find(x=>String(x.id)===String(id));if(item){state.modal={type:"teacher",item};render()}return}
    if(a==="reset-teacher-password"){state.modal={type:"confirm-teacher-reset",teacherId:id};render();return}
    if(a==="confirm-teacher-reset"){try{const r=await api(`/api/teachers/${encodeURIComponent(id)}/reset-password`,{method:"POST",body:{}});state.modal={type:"password-success",password:String(r.initial_password||"")};render()}catch(e){state.modal=null;render();toast(e.message,"error")}return}
    if(a==="remove-assignment"){if(!confirm("Remove this teacher assignment?"))return;try{await api(`/api/rm/assignments/${encodeURIComponent(button.dataset.assignment)}`,{method:"DELETE"});toast("Assignment removed.");await loadRoute("teachers")}catch(e){toast(e.message,"error")}return}
    if(a==="apply-learners"){const search=document.getElementById("learner-search");if(search)state.filter.search=search.value.trim();await loadRoute("learners");return}
    if(a==="import-csv"){document.getElementById("csv-file")?.click();return}
    if(a==="apply-level-subjects"||a==="apply-level-grading"){const select=document.querySelector(`[data-filter="level"]`);state.filter.level=select?.value||"";if(state.route==="settings")render();else await loadRoute(state.route);return}
    if(a==="seed-subjects"||a==="seed-grading"){
      const selectedLevel=a==="seed-subjects"?document.getElementById("subject-level")?.value:state.filter.level;
      const level=selectedLevel||state.filter.level||prompt("Choose level: NURSERY, PRIMARY, O_LEVEL, or A_LEVEL","PRIMARY");
      if(!level)return;
      const normalized=String(level).trim().toUpperCase();
      if(!LEVELS.some(x=>x[0]===normalized)){toast("Enter a valid school level.","error");return}
      const endpoint=a==="seed-subjects"?"/api/subjects/seed-defaults":"/api/grading/seed-defaults";
      const payload={level:normalized};
      const requestUrl=API+endpoint;
      try{
        const r=await api(endpoint,{method:"POST",body:payload});
        console.info("[subjects-defaults] request",JSON.stringify({method:"POST",url:requestUrl,payload}));
        console.info("[subjects-defaults] response",JSON.stringify({status:200,level:r.level,inserted:r.inserted,updated:r.updated,subjects:r.subjects}));
        state.filter.level=normalized;
        if(a==="seed-subjects"){
          await loadRoute("subjects");
          const rows=(state.data.subjects||[]).filter(subject=>String(subject.level||"").toUpperCase()===normalized);
          const core=rows.filter(subject=>(subject.category||"CORE")==="CORE").length;
          const other=rows.filter(subject=>subject.category==="OTHER").length;
          console.info("[subjects-defaults] refreshed list",JSON.stringify({level:normalized,total:rows.length,core,other}));
          if(normalized==="NURSERY"&&(core<5||other<10)){
            const message=`Nursery defaults request succeeded, but the refreshed list has ${core} core areas and ${other} activities. Reload and try again.`;
            state.data.subjectsError=message;
            render();
            toast(message,"error");
            return;
          }
        }else await loadRoute(state.route);
        const changed=Number(r.inserted||0)+Number(r.updated||0);
        toast(changed?`${changed} defaults added or corrected for ${levelLabel(normalized)}.`:`${levelLabel(normalized)} defaults are already up to date.`);
      }catch(e){
        console.error("[subjects-defaults] failed",JSON.stringify({url:requestUrl,payload,error:e.message}));
        toast(e.message,"error");
      }
      return;
    }
    if(a==="dashboard"||a==="classes"||a==="learners"||a==="subjects"||a==="grading"||a==="teachers"||a==="marks"||a==="projects"||a==="settings"){await loadRoute(a);return}
    if(a==="load-marks"){await loadMarks();return}
    if(a==="open-assigned"){state.filter.class_id=button.dataset.class;state.filter.subject_id=button.dataset.subject;state.route="marks";location.hash="marks";render();await loadTeacherMarks();return}
    if(a==="load-teacher-marks"){await loadTeacherMarks();return}
     if(a==="save-teacher-marks"){openMarkCommentFlow("teacher-save");return}
      if(a==="submit-marks-review"){openMarkCommentFlow("teacher-submit");return}
     if(a==="save-comment"){openMarkCommentFlow("comment-only",button.dataset.learner);return}
     if(a==="apply-mark-comment-choice"){await applyMarkCommentChoice();return}
     if(a==="save-promotion-review"){await savePromotionReview(button);return}
     if(a==="save-report-promotion"){await saveReportPromotion(button);return}
    if(a==="save-signature"){await persistSignature();return}
    if(a==="clear-signature"){const c=document.getElementById("signature-canvas");c?.getContext("2d").clearRect(0,0,c.width,c.height);return}
    if(a==="load-review"){await loadReviewQueue();return}
    if(a==="view-submission"){const row=(state.rm.review||[]).find(x=>String(x.id)===String(id));if(row){try{const q=new URLSearchParams({subject_id:row.subject_id,term:row.term,year:String(row.year)});const data=await api(`/api/rm/class/${encodeURIComponent(row.class_id)}/marks?${q}`);state.modal={type:"review-entry",submission:row,learners:data.learners||[],period:{subject_id:row.subject_id,term:row.term,year:Number(row.year)}};render()}catch(e){toast(e.message,"error")}}return}
    if(a==="save-review-edit"){const m=state.modal;if(!m)return;const rows=[...document.querySelectorAll("#review-edit-table tbody tr")].map(tr=>{const out={learner_id:tr.dataset.learner};tr.querySelectorAll("[data-review-score]").forEach(i=>out[i.dataset.reviewScore]=i.value===""?null:Number(i.value));const original=m.learners.find(l=>String(l.learner_id)===String(tr.dataset.learner));return {...out,paper_number:original?.paper_number??null,teacher_initials:original?.teacher_initials??null}});try{await api(`/api/rm/class/${encodeURIComponent(m.submission.class_id)}/marks-bulk`,{method:"POST",body:{...m.period,rows}});toast("Review edits saved.");state.modal=null;await loadReviewQueue()}catch(e){toast(e.message,"error")}return}
     if(a==="approve-submission"||a==="return-submission"){const comment=a==="return-submission"?prompt("Add a note for the teacher (optional):"):"";if(comment===null)return;try{await api(`/api/rm/submissions/${encodeURIComponent(id)}/review`,{method:"POST",body:{decision:a==="approve-submission"?"approve":"return",...(comment?{comment}: {})}});toast(a==="approve-submission"?"Submission approved.":"Submission returned to teacher.");await loadReviewQueue()}catch(e){toast(e.message,"error")}return}
    if(a==="publish-submission"){if(!confirm("Publish these results to report cards?"))return;try{await api(`/api/rm/submissions/${encodeURIComponent(id)}/publish`,{method:"POST",body:{}});toast("Results published.");await loadReviewQueue()}catch(e){toast(e.message,"error")}return}
     if(a==="save-marks"){await saveMarks();return}
     if(a==="toggle-mark-fullscreen"){toggleMarkFullscreen();return}
    if(a==="load-report-class"){await loadReportClass();return}
    if(a==="load-project-register"){await loadProjectRegister();return}
    if(a==="download-report-pdf"){await downloadReportPdf();return}
    if(a==="download-class-zip"){await downloadClassZip();return}
    if(a==="reload"){await loadRoute(state.route);return}
  }
   async function saveTeacherMarks(notify=true,rowsOverride=null){
      const period=markEntryPeriod();
     const rows=rowsOverride||collectMarkRows("teacher-marks-table");
     for(const row of rows){
        const invalid=period.fields.some(({key})=>row[key]!==null&&(!Number.isFinite(row[key])||row[key]<0||row[key]>100));
        if(invalid){toast("Assessment-period marks must be between 0 and 100.","error");return false}
       if(row.paper_number!==null&&row.paper_number!==undefined&&(!Number.isInteger(row.paper_number)||row.paper_number<1||row.paper_number>20)){toast("Paper number must be a whole number from 1–20.","error");return false}
     }
      try{await api(`/api/rm/class/${encodeURIComponent(state.filter.class_id)}/marks-bulk`,{method:"POST",body:{subject_id:state.filter.subject_id,term:state.filter.term,year:Number(state.filter.academic_year),assessment_period:period.value,rows}});if(notify)toast(`Saved ${rows.length} learner records.`);return true}catch(e){toast(e.message,"error");return false}
  }
   async function saveTeacherComment(learnerId){
    const field=document.querySelector(`[data-comment="${CSS.escape(learnerId)}"]`),status=document.querySelector(`[data-comment-state="${CSS.escape(learnerId)}"]`);if(!field)return;
    const write=(text,kind="")=>{if(status){status.className=`comment-save-state ${kind}`;status.textContent=text}};
    write("Saving comment…");
     try{await api(`/api/rm/cards/${encodeURIComponent(learnerId)}/class-teacher-comment`,{method:"POST",body:{term:state.filter.term,year:Number(state.filter.academic_year),comment:field.value.trim()}});state.rm.comments[learnerId]=field.value.trim();write("Comment saved","success");return true}catch(e){write(`Could not save: ${e.message}`,"error");return false}
  }
   async function saveTeacherComments(){const fields=[...document.querySelectorAll("[data-comment]")];for(const field of fields){if(!await saveTeacherComment(field.dataset.comment)){toast("A class-teacher comment could not be saved; marks were not submitted.","error");return false}}return true}
   async function savePromotionReview(button){const rows=[...document.querySelectorAll("[data-promotion-learner]")];if(!rows.length)return;button.disabled=true;button.textContent="Saving…";try{for(const row of rows){const decision=row.querySelector("[data-promotion-decision]")?.value||"pending";await api("/api/learner-term-results/promotion",{method:"POST",body:{learner_id:row.dataset.promotionLearner,term:"TERM_3",year:Number(state.filter.academic_year),promotion_decision:decision}})}toast(`Saved ${rows.length} promotion decisions.`);await loadReviewQueue()}catch(error){toast(error.message||"Could not save all promotion decisions.","error");button.disabled=false;button.innerHTML=`${icon("fa-floppy-disk")} Save all decisions`}}
   async function saveReportPromotion(button){const selected=reportState.data?.learners?.find(r=>String(r.learner.id)===String(reportState.learnerId));if(!selected)return;const decision=document.getElementById("report-promotion-decision")?.value||"pending";const note=document.getElementById("report-promotion-note")?.value.trim()||"";reportState.promotionBusy=true;render();try{await api("/api/learner-term-results/promotion",{method:"POST",body:{learner_id:selected.learner.id,term:"TERM_3",year:Number(reportState.year),promotion_decision:decision,promotion_note:note||null}});reportState.promotionBusy=false;await loadReportClass();toast("Promotion decision saved.")}catch(error){reportState.promotionBusy=false;reportState.promotionError=error.message;render();toast(error.message,"error")}}
  function canvasPoint(canvas,event){const rect=canvas.getBoundingClientRect();return {x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height}}
  let drawing=false,lastPoint=null;
  async function persistSignature(){
    const canvas=document.getElementById("signature-canvas");if(!canvas)return;
    const data_url=canvas.toDataURL("image/png");const status=document.querySelector(".signature-card .section-title");
    state.rm.signatureStatus={text:"Saving signature…",kind:"success"};if(status){const note=document.createElement("p");note.className="signature-inline-status";note.textContent="Saving signature…";status.after(note)}
    try{await api("/api/rm/teachers/signature",{method:"POST",body:{data_url}});state.rm.signature={data_url};state.rm.signatureStatus={text:"Signature saved.",kind:"success"};render()}catch(e){state.rm.signatureStatus={text:`Could not save signature: ${e.message}`,kind:"error"};render()}
  }
     async function saveMarks(rowsOverride=null,notify=true){
      const period=markEntryPeriod();
      const rows=rowsOverride||collectMarkRows("marks-table");
       for(const row of rows){if(period.fields.some(({key})=>row[key]!==null&&(!Number.isFinite(row[key])||row[key]<0||row[key]>100))){toast("Assessment-period marks must be between 0 and 100.","error");return false}if(row.paper_number!==undefined&&row.paper_number!==null&&(!Number.isInteger(row.paper_number)||row.paper_number<1||row.paper_number>20)){toast("Paper number must be a whole number from 1 to 20.","error");return false}}
        const failures=[];state.data.savingMarks=true;render();
        for(const row of rows){const body={term:state.filter.term,year:Number(state.filter.academic_year),...Object.fromEntries(period.fields.map(({key})=>[key,row[key]??null])),teacher_initials:row.teacher_initials,tr:row.tr,tr_mode:row.tr_mode,...(Object.hasOwn(row,"paper_number")?{paper_number:row.paper_number}:{}),...(Object.hasOwn(row,"overall_grade_code")?{overall_grade_code:row.overall_grade_code,grade_point_type:row.grade_point_type}:{})};try{await api(`/api/learners/${encodeURIComponent(row.learner_id)}/marks/${encodeURIComponent(state.filter.subject_id)}`,{method:"PATCH",body})}catch(error){failures.push(`${row.learner_id}: ${error.message}`)}}
    state.data.savingMarks=false;await loadMarks();
     if(failures.length){toast(`${rows.length-failures.length} of ${rows.length} learners saved; ${failures.length} failed. ${failures[0]}`,"error");return false}
     if(notify)toast(`Marks saved for ${rows.length} learners.`);
     return true;
  }
   function uiGradeForScore(level,score,competencyAverage=null,className="",subjectId="",teacher=false){
    const normalizedClass=String(className).toUpperCase().replace(/[^A-Z0-9]/gu,"");
    const primaryLevel=String(level||"").toUpperCase().replace(/[^A-Z0-9]/gu,"");
    const lowerPrimary=primaryLevel==="PRIMARY"&&/^(?:P|PRIMARY)[1-3]$/u.test(normalizedClass);
    if(lowerPrimary){const average=competencyAverage===null?(score/100)*3:competencyAverage;return average>=2.5?"3":average>=1.5?"2":"1"}
     const upperPrimary=primaryLevel==="PRIMARY"&&/^(?:P|PRIMARY)[4-7]$/u.test(normalizedClass);
     if(upperPrimary){
       const subjectRows=teacher?(state.rm.subjectGradeScales||[]):(state.data.subjectGrading||[]);
       const matchingSubject=subjectRows.filter(row=>String(row.subject_id)===String(subjectId));
       const subjectBand=matchingSubject.find(row=>Number(row.min_score)<=score&&Number(row.max_score)>=score);
       if(subjectBand)return subjectBand.grade_code;
     }
     const rows=teacher?(state.rm.gradeScales||[]):(state.data.grading||[]);
    const matching=rows.find(row=>row.level===level&&Number(row.min_score)<=score&&Number(row.max_score)>=score);
    if(matching)return matching.grade_code;
    if(level==="NURSERY")return score>=70?"3":score>=60?"2A":score>=50?"2B":score>=40?"1A":"1B";
    if(level==="A_LEVEL")return score>=75?"A":score>=65?"B":score>=50?"C":score>=35?"D":"E";
    return score>=80?"A":score>=70?"B":score>=60?"C":score>=50?"D":"E";
  }
  function livePeriodScore(values){
    const scores=values.map(value=>value===""||value===null||value===undefined?null:Number(value)).filter(score=>Number.isFinite(score)&&score>=0&&score<=100);
    return scores.length?scores.reduce((sum,score)=>sum+score,0)/scores.length:null;
  }
  function updateLiveMarkInput(target){
    const input=target?.closest?.("[data-score],[data-mark-period-score]");
    if(!input)return false;
    calculateMarks(input.closest("tr"));
    return true;
  }
  function calculateMarks(tr){
    const vals={};tr.querySelectorAll("[data-score]").forEach(input=>vals[input.dataset.score]=input.value===""?null:Number(input.value));
    const periodInputs=[...tr.querySelectorAll("[data-mark-period-score]")];
    const periodScore=livePeriodScore(periodInputs.map(input=>input.value));
    const rawMode=Object.hasOwn(vals,"raw_mark"),teacher=state.role==="teacher";
    const max=Number(tr.querySelector('[data-score="raw_mark"]')?.max)||(teacher?state.rm.rawMarkMax:state.data.rawMarkMax)||100;
    let avg=null,pct20=null,pct80=null,pct100=null,identifier=null;
    if(rawMode){pct100=vals.raw_mark===null?null:(max===3?vals.raw_mark/3*100:vals.raw_mark);avg=vals.raw_mark===null?null:(max===3?vals.raw_mark:(vals.raw_mark/100)*3)}
    else{
       avg=[vals.a1,vals.a2,vals.a3].every(Number.isFinite)?(vals.a1+vals.a2+vals.a3)/3:null;
       pct20=avg===null?null:(avg/3)*20;pct80=Number.isFinite(vals.eot)?(vals.eot/100)*80:null;pct100=pct20===null||pct80===null?null:pct20+pct80;
      identifier=avg===null?null:avg>=2.5?3:avg>=1.5?2:1;
    }
    const selectedClass=(state.data.classes||[]).find(c=>String(c.id)===String(state.filter.class_id));
    const level=teacher?state.rm.class?.level:selectedClass?.level;
    const className=teacher?state.rm.class?.name:selectedClass?.name;
     const subjectId=teacher?state.rm.subject?.id:state.filter.subject_id;
     const gradeScore=periodInputs.length?periodScore:pct100;
     const gradeAverage=periodInputs.length?null:avg;
     const grade=gradeScore===null?null:uiGradeForScore(level,gradeScore,gradeAverage,className,subjectId,teacher);
    const write=(key,value)=>{const el=tr.querySelector(`[data-result="${key}"]`);if(el)el.textContent=value===null?"—":Number(value).toFixed(2)};
    write("avg",avg);write("pct20",pct20);write("pct80",pct80);write("pct100",pct100);write("identifier",identifier);
     const gradeEl=tr.querySelector('[data-result="grade"] [data-grade-label]');
     if(gradeEl){
       const overall=tr.querySelector("[data-overall-grade]")?.value||"";
       const type=tr.querySelector("[data-grade-point-type]")?.checked?"subsidiary":"principal";
        const points=pointsForMark(level,grade,overall,type,teacher,teacher?state.rm.subject?.id:state.filter.subject_id);
       const old=level==="A_LEVEL"&&legacyALevel(teacher);
       gradeEl.textContent=old?[grade,overall&&`${overall}${points!==null?` · ${points} pts`:""}`].filter(Boolean).join(" · ")||"—":`${grade||"—"}${points!==null?` · ${points} pts`:""}`;
     }
     const remarkMode=tr.querySelector("[data-tr-mode]")?.value||"auto";
     const autoPanel=tr.querySelector('[data-tr-panel="auto"]');
      if(autoPanel&&remarkMode==="auto")autoPanel.textContent=subjectRemarkForUi(grade,subjectNameForUi(teacher,subjectId))||"Enter a valid mark to generate this subject remark.";
  }
  async function loadReportLearners(classId=reportState.classId){
    const requestId=++reportState.rosterRequestId;
    reportState.rosterError="";
    reportState.learners=[];
    reportState.rosterBusy=Boolean(classId);
    if(!classId){reportState.rosterBusy=false;render();return}
    render();
    try{
      const query=new URLSearchParams({class_id:String(classId)});
      const response=await api(`/api/learners?${query}`);
      if(requestId!==reportState.rosterRequestId)return;
      if(!Array.isArray(response.learners))throw new Error("The learner list could not be loaded. Please reload and try again.");
      reportState.learners=response.learners;
      if(!reportState.learners.some(learner=>String(learner.id)===String(reportState.learnerId)))reportState.learnerId=reportState.learners[0]?.id||"";
    }catch(error){
      if(requestId===reportState.rosterRequestId){reportState.learners=[];reportState.rosterError=error.message||"Could not load learners for this class."}
    }finally{
      if(requestId===reportState.rosterRequestId){reportState.rosterBusy=false;render()}
    }
  }
   function apiReportPeriod(value=reportState.period){
     const period=window.ReportCardTemplatePicker.normalizePeriod(value);
     return period==="COMBINED_BM"?"COMBINED_BME":period;
   }
   async function issueReportAuthenticityCodes(reports){
     const learnerIds=[...new Set((reports||[]).map(report=>String(report.learner?.id||"")).filter(Boolean))];
     if(!learnerIds.length||reportState.layoutFormat==="A5_CONDENSED")return{};
     if(!window.ReportCardsAuthenticityQr)throw new Error("QR verification support did not load. Refresh and try again.");
     const response=await api("/api/verify/issue",{method:"POST",body:{
       learner_ids:learnerIds,
       term:reportState.term,
       year:Number(reportState.year),
       period:apiReportPeriod(reportState.period),
       template:window.ReportCardTemplatePicker.normalizeTemplate(reportState.template),
      comments_by_learner:Object.fromEntries((reports||[]).map(report=>[
        String(report.learner?.id||""),
        {
          head_teacher_comment:report.stored_report_card_comments?.head_teacher_comment||null,
          principal_comment:report.stored_report_card_comments?.principal_comment||null,
        },
      ]).filter(([learnerId])=>learnerId)),
     }});
     const records=new Map((response.cards||[]).map(card=>[String(card.learner_id),card]));
     const entries=await Promise.all(learnerIds.map(async learnerId=>{
       const record=records.get(learnerId);
       if(!record?.id)throw new Error("The authenticity record was not created for every learner.");
       const url=window.ReportCardsAuthenticityQr.verificationUrl(record.id);
       const qrDataUrl=await window.ReportCardsAuthenticityQr.toPngDataUrl(url);
       return [learnerId,{id:record.id,url,qrDataUrl}];
     }));
     return Object.fromEntries(entries);
   }
   async function loadSelectedReportVerification(){
     if(reportState.layoutFormat==="A5_CONDENSED")return;
     const report=reportState.data?.learners?.find(item=>String(item.learner?.id)===String(reportState.learnerId));
     if(!report)return;
     const learnerId=String(report.learner.id);
     if(reportState.verifications[learnerId])return;
     const requestId=++reportState.verificationRequestId;
     reportState.verificationBusy=true;
     reportState.verificationError="";
     render();
     try{
       const codes=await issueReportAuthenticityCodes([report]);
       if(requestId===reportState.verificationRequestId)reportState.verifications={...reportState.verifications,...codes};
     }catch(error){
       if(requestId===reportState.verificationRequestId)reportState.verificationError=error.message||"Could not prepare the authenticity QR code.";
     }finally{
       if(requestId===reportState.verificationRequestId){reportState.verificationBusy=false;render()}
     }
   }
   async function loadReportClass(){
     if(!reportState.classId){reportState.error="Choose a class first.";render();return}
     if(!/^\d{4}$/.test(String(reportState.year))){reportState.error="Enter a valid four-digit year.";render();return}
     reportState.busy=true;
     reportState.error="";
     reportState.promotionError="";
     reportState.verificationError="";
     reportState.verificationBusy=false;
     reportState.verificationRequestId++;
     reportState.verifications={};
     render();
     const q=new URLSearchParams({
       term:reportState.term,
       year:String(reportState.year),
       period:apiReportPeriod(reportState.period),
       template:window.ReportCardTemplatePicker.normalizeTemplate(reportState.template),
     });
     try{
       const classId=reportState.classId;
       const learnerQuery=new URLSearchParams({class_id:classId});
       const [,cardData,rosterData]=await Promise.all([
         window.ReportCardThemeEngine?.load(api),
         api(`/api/class/${encodeURIComponent(classId)}/card-data?${q}`),
         api(`/api/learners?${learnerQuery}`),
       ]);
       reportState.data=cardData;
       reportState.learners=rosterData.learners||[];
       if(reportState.term==="TERM_3"){
         try{
           const promotion=await api(`/api/class/${encodeURIComponent(classId)}/promotion-suggestions?term=TERM_3&year=${encodeURIComponent(reportState.year)}`);
           const byLearner=new Map((promotion.suggestions||[]).map(item=>[String(item.learner.id),item]));
           cardData.learners=(cardData.learners||[]).map(item=>{
             const decision=byLearner.get(String(item.learner.id));
             return {...item,promotion:decision||null,promotion_decision:decision?.promotion_decision||decision?.suggested_decision||null,suggested_decision:decision?.suggested_decision||null,promotion_note:decision?.promotion_note||null,promotion_current_class:decision?.current_class||promotion.current_class||cardData.class?.name,promotion_next_class:decision?.next_class||promotion.next_class};
           });
         }catch(error){reportState.promotionError=error.message}
       }
       const reports=cardData.learners||[];
       const mismatches=reportState.learners.filter(learner=>!reports.some(report=>String(report.learner.id)===String(learner.id)));
       if(mismatches.length)reportState.error="The class register and report-card data returned different learners. Reload the preview and try again.";
       if(!reportState.learners.some(learner=>String(learner.id)===String(reportState.learnerId)))reportState.learnerId=reportState.learners[0]?.id||"";
       const selected=reports.find(report=>String(report.learner?.id)===String(reportState.learnerId));
       if(selected&&reportState.layoutFormat!=="A5_CONDENSED"){
         reportState.verificationBusy=true;
         try{reportState.verifications=await issueReportAuthenticityCodes([selected])}
         catch(error){reportState.verificationError=error.message||"Could not prepare the authenticity QR code."}
         finally{reportState.verificationBusy=false}
       }
     }catch(error){
       reportState.data=null;
       reportState.learners=[];
       reportState.error=error.message;
     }finally{
       reportState.busy=false;
       render();
     }
   }
  function saveDownload(blob,name){const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
   function filePart(value){return String(value||"learner").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Za-z0-9_-]+/g,"_").replace(/_+/g,"_").replace(/^[-_]+|[-_]+$/g,"").slice(0,90)||"learner"}
    function reportForDownload(report,stampConfig,verification=reportState.verifications[String(report.learner?.id)]){
      const ages=(reportState.data?.learners||[]).map(item=>Number(item.learner?.age)).filter(age=>Number.isFinite(age)&&age>0);
      const classAverageAge=ages.length?ages.reduce((sum,age)=>sum+age,0)/ages.length:null;
      const school=reportState.data?.school||{};
      const apiStamp=stampConfig?.stamp_config;
      const classStamp={...(school.stamp_config&&typeof school.stamp_config==="object"?school.stamp_config:{}),...(reportState.data?.stamp_config&&typeof reportState.data.stamp_config==="object"?reportState.data.stamp_config:{})};
      const stamp={
        ...(classStamp&&typeof classStamp==="object"?classStamp:{}),
        ...(apiStamp&&typeof apiStamp==="object"?apiStamp:stampConfig&&typeof stampConfig==="object"&&!Object.hasOwn(stampConfig,"stamp_config")?stampConfig:{}),
      };
      const stampLogoPosition=stampConfig?.stamp_logo_position??school.stamp_logo_position??stamp.stamp_logo_position??"inside_center";
      const defaults={stamp_logo_size:20,stamp_logo_offset_x:0,stamp_logo_offset_y:0,stamp_logo_rotation:0,stamp_logo_opacity:100};
      const logoSettings=Object.fromEntries(Object.keys(defaults).map(key=>[key,stampConfig?.[key]??school[key]??defaults[key]]));
     const showStamp=stampConfig?.show_stamp??school.show_stamp??true;
     return {...report,school:{...school,show_stamp:showStamp,stamp_config:stamp,stamp_logo_position:stampLogoPosition,...logoSettings},class:reportState.data.class,term:reportState.data.term,year:reportState.data.year,term_dates:reportState.data.term_dates,period:reportState.period,layout_format:reportState.layoutFormat,template:reportState.template,level_theme:reportState.data.level_theme,stamp_config:stamp,class_average_age:classAverageAge,authenticity_qr_data_url:verification?.qrDataUrl};
    }
  function incompletePleMessage(report){
    if(!report?.ple_official_enabled)return "";
    const missing=Array.isArray(report.incomplete_marks)?report.incomplete_marks:[];
    return missing.length?`Incomplete marks: ${missing.join(", ")}`:"";
  }
  async function printReportCards(wholeClass){
    const reports=reportState.data?.learners||[];
    const selected=reports.find(item=>String(item.learner?.id)===String(reportState.learnerId));
    const list=wholeClass?reports:(selected?[selected]:[]);
    if(!list.length){toast(wholeClass?"Load a class first.":"Choose a learner first.","error");return}
    const incomplete=list.find(item=>incompletePleMessage(item));
    if(incomplete){toast(`${incomplete.learner?.full_name||"Learner"} — ${incompletePleMessage(incomplete)}`,"error");return}
    try{
      const stamp=reportState.includeStamp?await api("/api/schools/stamp"):undefined;
      const verificationCodes=await issueReportAuthenticityCodes(list);
      const printRoot=document.createElement("div");printRoot.id="rc-print-root";
      printRoot.dataset.layoutFormat=reportState.layoutFormat;
      printRoot.innerHTML=list.map(item=>`<section class="rc-print-card">${window.ReportCardPreview.render(reportForDownload(item,stamp,verificationCodes[String(item.learner?.id)]),{template:reportState.template,period:reportState.period,includeStamp:reportState.includeStamp})}</section>`).join("");
      document.getElementById("rc-print-root")?.remove();
      document.body.append(printRoot);document.body.classList.add("printing-report-cards");
      const cleanup=()=>{document.body.classList.remove("printing-report-cards");printRoot.remove()};
      window.addEventListener("afterprint",cleanup,{once:true});
      setTimeout(()=>window.print(),120);
    }catch(error){toast(error.message||"Could not prepare the report cards for printing.","error")}
  }
  async function downloadReportImage(){
    const selected=reportState.data?.learners?.find(item=>String(item.learner?.id)===String(reportState.learnerId));
    if(!selected){toast("Choose a learner first.","error");return}
    if(incompletePleMessage(selected)){toast(incompletePleMessage(selected),"error");return}
    if(typeof window.html2canvas!=="function"){toast("The image-export library did not load. Refresh and try again.","error");return}
    const selector=reportState.fullscreen?".rc-preview-fullscreen .rc-preview":".rc-preview-viewer:not(.rc-preview-fullscreen) .rc-preview";
    const target=root.querySelector(selector);
    if(!target){toast("The report card preview is not ready yet.","error");return}
    try{
      await Promise.all([...target.querySelectorAll("img")].map(image=>image.complete?Promise.resolve():new Promise(resolve=>{image.onload=resolve;image.onerror=resolve})));
      const canvas=await window.html2canvas(target,{scale:2,backgroundColor:"#ffffff",useCORS:true,logging:false});
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
      if(!blob)throw new Error("Could not encode the preview as a PNG.");
      saveDownload(blob,`${filePart(selected.learner.full_name)}_${filePart(reportState.term)}_${filePart(reportState.year)}_report_card.png`);
    }catch(error){toast(error.message||"Could not export the report card image.","error")}
  }
  async function downloadReportPdf(){
    const report=reportState.data?.learners?.find(r=>String(r.learner.id)===String(reportState.learnerId));
    if(!report){toast("Load a class and choose a learner first.","error");return}
    if(incompletePleMessage(report)){toast(incompletePleMessage(report),"error");return}
    if(!window.ReportCardPdf||!window.PDFLib){toast("The PDF library did not load. Refresh and try again.","error");return}
     try{let verification=reportState.verifications[String(report.learner.id)];if(!verification){const codes=await issueReportAuthenticityCodes([report]);verification=codes[String(report.learner.id)];reportState.verifications={...reportState.verifications,...codes}}const currentStamp=reportState.includeStamp?await api("/api/schools/stamp"):undefined;const bytes=await window.ReportCardPdf.render(reportForDownload(report,currentStamp,verification),reportState.data.class.level,reportState.template,reportState.includeStamp);saveDownload(new Blob([bytes],{type:"application/pdf"}),`${filePart(report.learner.full_name)}_${filePart(reportState.term)}_${filePart(reportState.year)}_ReportCard.pdf`)}
    catch(error){toast(error.message||"Could not generate the PDF.","error")}
  }
  async function downloadClassZip(){
    const reports=reportState.data?.learners||[];
    if(!reports.length){toast("Load a class first.","error");return}
    const incomplete=reports.find(report=>incompletePleMessage(report));
    if(incomplete){toast(`${incomplete.learner?.full_name||"Learner"} — ${incompletePleMessage(incomplete)}`,"error");return}
    if(!window.ReportCardPdf||!window.PDFLib){toast("The PDF library did not load. Refresh and try again.","error");return}
    reportState.busy=true;render();
     try{const [currentStamp,verificationCodes]=await Promise.all([reportState.includeStamp?api("/api/schools/stamp"):Promise.resolve(undefined),issueReportAuthenticityCodes(reports)]);const files=[];for(const report of reports){const verification=verificationCodes[String(report.learner?.id)];const bytes=await window.ReportCardPdf.render(reportForDownload(report,currentStamp,verification),reportState.data.class.level,reportState.template,reportState.includeStamp);files.push({name:`${filePart(report.learner?.full_name)}_${filePart(reportState.term)}_${filePart(reportState.year)}_ReportCard.pdf`,bytes})}const zip=window.ReportCardPdf.createZip(files);saveDownload(zip,`${filePart(reportState.data.class.name)}_${filePart(reportState.term)}_${filePart(reportState.year)}_ReportCards.zip`);toast(`Downloaded ${reports.length} report cards.`)}
    catch(error){toast(error.message||"Could not create the class ZIP.","error")}
    finally{reportState.busy=false;render()}
  }

  async function uploadNurseryActivityIcon(input){
    const activityName=input.dataset.activityIconFile,file=input.files?.[0];
    if(!activityName||!file)return;
    state.data.activityIconBusy=activityName;state.data.activityIconError="";render();
    try{
      const iconBase64=await compressNurseryActivityIcon(file);
      const result=await api("/api/school/activity-icons",{method:"PATCH",body:{activity_name:activityName,icon_base64:iconBase64}});
      const saved=result.icon;
      state.data.activityIcons=[...(state.data.activityIcons||[]).filter(item=>item.activity_name!==activityName),saved].sort((a,b)=>a.activity_name.localeCompare(b.activity_name));
      if(reportState.data?.school)reportState.data.school={...reportState.data.school,activity_icons:state.data.activityIcons};
      state.data.activityIconBusy="";render();toast(`${activityName} icon saved.`);
    }catch(error){
      state.data.activityIconBusy="";state.data.activityIconError=error.message||"Could not save the activity icon.";render();
    }
  }
  async function saveSchoolSettings(form){
    if(!form.reportValidity())return;
    const fd=new FormData(form);
    const body={
      current_term:String(fd.get("current_term")||""),
      current_year:Number(fd.get("current_year")),
      mark_entry_mode:String(fd.get("mark_entry_mode")||"CBC"),
      show_report_position:fd.get("show_report_position")==="on",
      primary_result_metric:String(fd.get("primary_result_metric")||"average"),
      term_ended_on:String(fd.get("term_ended_on")||""),
      next_term_begins:String(fd.get("next_term_begins")||""),
      next_term_fees:String(fd.get("next_term_fees")||""),
    };
    state.data.savingSettings=true;render();
    try{
      const result=await api("/api/school/term-settings",{method:"PATCH",body});
      const saved=result.term_dates||{};
      state.data.schoolSettings={...state.data.schoolSettings,...saved};
      if(reportState.data){
        reportState.data.term_dates={...reportState.data.term_dates,...saved};
        reportState.data.school={...reportState.data.school,current_term:saved.current_term,current_year:saved.current_year,show_report_position:saved.show_report_position,primary_result_metric:saved.primary_result_metric};
      }
      state.data.savingSettings=false;render();toast("School term settings saved.");
    }catch(error){
      state.data.savingSettings=false;render();
      const target=document.getElementById("settings-error");
      if(target)target.innerHTML=`<div class="alert error" role="alert">${esc(error.message)}</div>`;
    }
  }
  async function saveSchoolProfile(form){
    if(!form.reportValidity())return;
    const fd=new FormData(form);
    const body=Object.fromEntries(["name","motto","street","po_box","city","district","phone","email","website","admission_number_mode"].map(key=>[key,String(fd.get(key)||"").trim()]));
    state.data.savingSchoolProfile=true;state.data.schoolProfileError="";render();
    try{
      const result=await api("/api/school/me",{method:"PATCH",body});
      const saved=result.school||{};
      state.data.schoolSettings={...state.data.schoolSettings,...saved};
      state.school={...state.school,...saved};
      if(reportState.data?.school)reportState.data.school={...reportState.data.school,...saved};
      state.data.savingSchoolProfile=false;render();toast("School profile saved.");
    }catch(error){
      state.data.savingSchoolProfile=false;state.data.schoolProfileError=error.message||"Could not save school profile.";render();
    }
  }
  async function saveSchoolTheme(form){
    if(!form.reportValidity())return;
    const fd=new FormData(form);
    const body=Object.fromEntries(["report_primary_color","report_font_color","report_background_color"].map(key=>[key,String(fd.get(key)||"")]));
    state.data.savingSchoolTheme=true;state.data.schoolThemeError="";render();
    try{
      const result=await api("/api/school/me",{method:"PATCH",body});
      const saved=result.school||{};
      state.data.schoolSettings={...state.data.schoolSettings,...saved};
      state.school={...state.school,...saved};
      if(reportState.data?.school)reportState.data.school={...reportState.data.school,...saved};
      state.data.savingSchoolTheme=false;render();toast("Report-card theme saved.");
    }catch(error){
      state.data.savingSchoolTheme=false;state.data.schoolThemeError=error.message||"Could not save report-card theme.";render();
    }
  }
  async function saveBrandingSettings(form){
    if(!form.reportValidity())return;
    const file=form.elements.school_logo_file.files?.[0]||null;
    const enabled=form.elements.watermark_enabled.checked;
    const opacity=Number(form.elements.watermark_opacity.value);
    let logoBase64=null;
    if(file){
      const allowedTypes=["image/png","image/jpeg"];
      if(!allowedTypes.includes(file.type)||file.size>2.75*1024*1024){
        state.data.brandingError="Choose a PNG or JPG logo no larger than 2.75 MB.";render();return;
      }
      try{logoBase64=await readImageFile(file)}catch(error){state.data.brandingError=error.message;render();return}
    }
    if(!Number.isInteger(opacity)||opacity<0||opacity>100){state.data.brandingError="Watermark opacity must be between 0 and 100.";render();return}
    if(enabled&&!logoBase64&&!state.data.schoolSettings?.logo_base64){state.data.brandingError="Upload a school logo before enabling the watermark.";render();return}
    const body={watermark_enabled:enabled,watermark_opacity:opacity};
    if(logoBase64)body.logo_base64=logoBase64;
    state.data.savingBranding=true;state.data.brandingError="";render();
    try{
      const result=await api("/api/school/me",{method:"PATCH",body});
      const saved=result.school||{};
      state.school={...(state.school||{}),...saved};
      state.data.schoolSettings={...(state.data.schoolSettings||{}),...saved};
      if(reportState.data)reportState.data.school={...(reportState.data.school||{}),...saved};
      state.data.savingBranding=false;render();toast("School branding settings saved.");
    }catch(error){state.data.savingBranding=false;state.data.brandingError=error.message;render()}
  }
  async function savePromotionRules(form){
    if(!form.reportValidity())return;
    const pass=Number(form.elements.promotion_pass_mark.value),tryMin=Number(form.elements.promotion_try_another_min.value);
    const target=document.getElementById("promotion-rules-error");
    if(!Number.isFinite(pass)||!Number.isFinite(tryMin)||tryMin>=pass){if(target)target.innerHTML='<div class="alert error" role="alert">The try-another threshold must be lower than the pass mark.</div>';return}
    state.data.savingPromotionRules=true;if(target)target.innerHTML="";render();
    try{const result=await api("/api/fin/settings",{method:"PATCH",body:{promotion_pass_mark:pass,promotion_try_another_min:tryMin}});state.data.promotionSettings=result.settings||{promotion_pass_mark:pass,promotion_try_another_min:tryMin};state.data.savingPromotionRules=false;render();toast("Promotion rules saved.")}
    catch(error){state.data.savingPromotionRules=false;render();const message=document.getElementById("promotion-rules-error");if(message)message.innerHTML=`<div class="alert error" role="alert">${esc(error.message)}</div>`}
  }
  async function submitSmsTest(form){
    if(!form.reportValidity())return;
    const button=form.querySelector('button[type="submit"]');
    const resultTarget=form.querySelector("#sms-test-result");
    const recipient=String(form.elements.recipient.value||"").trim();
    const message=String(form.elements.message.value||"").trim();
    if(button){button.disabled=true;button.textContent="Sending SMS…"}
    if(resultTarget)resultTarget.innerHTML='<div class="alert info" role="status">Sending one test message…</div>';
    try{
      const result=await api("/api/sms/send",{method:"POST",body:{recipient,message}});
      const accepted=result.status==="queued"?"Africa’s Talking accepted the message and queued it.":"Africa’s Talking accepted the message for sending.";
      const providerId=result.provider_message_id?` Provider message ID: ${esc(result.provider_message_id)}.`:"";
      if(resultTarget)resultTarget.innerHTML=`<div class="alert success" role="status">${accepted}${providerId}</div>`;
      form.elements.message.value="";
    }catch(error){
      if(resultTarget)resultTarget.innerHTML=`<div class="alert error" role="alert">${esc(error.message||"Could not send the SMS.")}</div>`;
    }finally{
      if(button){button.disabled=false;button.innerHTML=`${icon("fa-paper-plane")} Send test SMS`}
      try{state.data.smsWallet=await api("/api/sms/wallet");const balance=document.getElementById("sms-credit-balance");if(balance)balance.textContent=fmt(state.data.smsWallet.current_balance??0)}catch{}
    }
  }
  async function confirmSmsBundlePurchase(){
    const modal=state.modal;
    if(modal?.type!=="sms-bundle-purchase"||modal.busy)return;
    state.modal={...modal,busy:true,error:""};render();
    try{
      const result=await api("/api/sms/purchase",{method:"POST",body:{bundle_id:modal.bundle.id}});
      state.data.smsWallet=await api("/api/sms/wallet");
      state.modal=null;render();
      toast(`Added ${fmt(result.credits_added)} simulated SMS credits. No payment was collected.`);
    }catch(error){
      state.modal={...modal,busy:false,error:error.message||"Could not simulate the bundle purchase."};render();
    }
  }
  async function saveCommandCenterSmsBundle(form){
    if(!form.reportValidity())return;
    const id=form.dataset.id||"";
    const values={name:String(form.elements.name.value||"").trim(),credits:Number(form.elements.credits.value),price:Number(form.elements.price.value)};
    const modal=state.modal;
    state.modal={...modal,busy:true,bundle:{...(modal?.bundle||{}),...values}};render();
    try{
      await api(id?`/api/command-center/sms-bundles/${encodeURIComponent(id)}`:"/api/command-center/sms-bundles",{method:id?"PATCH":"POST",body:values});
      const result=await api("/api/command-center/sms-bundles");
      state.data.commandCenterBundles=result.bundles||[];
      state.data.commandCenterTab="sms-bundles";state.modal=null;render();toast(id?"SMS bundle updated.":"SMS bundle added.");
    }catch(error){
      state.modal={...state.modal,busy:false,error:error.message||"Could not save the SMS bundle."};render();
      const target=document.getElementById("cc-sms-bundle-error");if(target)target.innerHTML=`<div class="alert error" role="alert">${esc(error.message||"Could not save the SMS bundle.")}</div>`;
    }
  }
  async function addSchoolSmsCredits(form){
    if(!form.reportValidity())return;
    const schoolId=form.dataset.schoolId;
    const values={credits:Number(form.elements.credits.value),amount_paid:Number(form.elements.amount_paid.value||0),reference:String(form.elements.reference.value||"").trim()};
    const target=document.getElementById("cc-sms-credit-result");
    try{
      const result=await api(`/api/command-center/schools/${encodeURIComponent(schoolId)}/sms-wallet/credits`,{method:"POST",body:values});
      const details=await api(`/api/super-admin/schools/${encodeURIComponent(schoolId)}/details`);
      if(state.modal?.type==="command-center-school"&&String(state.modal.id)===String(schoolId))state.modal={...state.modal,details};
      render();toast(`Added ${fmt(result.credits_added)} SMS credits to ${details.school?.name||"the school"}.`);
    }catch(error){
      if(target)target.innerHTML=`<div class="alert error" role="alert">${esc(error.message||"Could not add SMS credits.")}</div>`;
    }
  }
  async function saveStampSettings(form){
    if(!form.reportValidity())return;
    const fd=new FormData(form);
      const body={show_stamp:fd.get("show_stamp")==="on",shape:String(fd.get("shape")||"circle"),primary_color:String(fd.get("primary_color")||"#1E5EB5"),secondary_color:String(fd.get("secondary_color")||"#000000"),line_1:String(fd.get("line_1")||""),line_2:String(fd.get("line_2")||""),line_3:String(fd.get("line_3")||""),line_4:String(fd.get("line_4")||""),line_5:String(fd.get("line_5")||""),position:String(fd.get("position")||"Bottom Right"),stamp_logo_position:String(fd.get("stamp_logo_position")||"inside_center"),stamp_logo_size:Number(fd.get("stamp_logo_size")??20),stamp_logo_offset_x:Number(fd.get("stamp_logo_offset_x")??0),stamp_logo_offset_y:Number(fd.get("stamp_logo_offset_y")??0),stamp_logo_rotation:Number(fd.get("stamp_logo_rotation")??0),stamp_logo_opacity:Number(fd.get("stamp_logo_opacity")??100),transparency:Number(fd.get("transparency")??100),rotation_degrees:Number(fd.get("rotation_degrees")??0)};
    const submit=form.querySelector('button[type="submit"]');
    state.data.savingStamp=true;state.data.stampError="";
    if(submit){submit.disabled=true;submit.textContent="Saving stamp…"}
    try{
      const result=await api("/api/schools/stamp",{method:"PATCH",body});
      state.data.stampConfig={...(result.stamp_config||body),show_stamp:result.show_stamp??body.show_stamp,stamp_logo_position:result.stamp_logo_position||body.stamp_logo_position,...Object.fromEntries(["stamp_logo_size","stamp_logo_offset_x","stamp_logo_offset_y","stamp_logo_rotation","stamp_logo_opacity"].map(key=>[key,result[key]??body[key]]))};
      state.data.schoolSettings={...(state.data.schoolSettings||{}),show_stamp:state.data.stampConfig.show_stamp};
      if(reportState.data?.school)reportState.data.school.show_stamp=state.data.stampConfig.show_stamp;
      state.data.stampError="";
      state.data.savingStamp=false;render();toast("Digital stamp settings saved.");
    }catch(error){
      state.data.stampConfig=body;
      state.data.stampError=error.message;
      state.data.savingStamp=false;render();toast(error.message,"error");
    }
  }
  window.ReportCardsAttendance?.bind(root,api,()=>render(),toast);
  root.addEventListener("change",e=>{
    const target=e.target;
    if(!target.matches("[data-report-filter]"))return;
    const key=target.dataset.reportFilter;
    if(key==="layoutFormat"||key==="period"){
      e.stopImmediatePropagation();
      if(key==="layoutFormat"){
        reportState.layoutFormat=window.ReportCardTemplatePicker.normalizeLayoutFormat(target.value);
        if(reportState.layoutFormat==="A5_CONDENSED")reportState.period="COMBINED_BM";
      }else{
        reportState.period=window.ReportCardTemplatePicker.normalizePeriod(target.value);
        if(reportState.layoutFormat==="A5_CONDENSED"&&reportState.period!=="COMBINED_BM"){
          reportState.layoutFormat="A4";
          toast("The A5 condensed format uses Combined (B.O.T + Midterm); Full Page (A4) was restored.");
        }
      }
      reportState.error="";
      if(reportState.data)loadReportClass();else render();
      return;
    }
    if(key==="classId"){
      e.stopImmediatePropagation();
      reportState.classId=target.value;
      reportState.data=null;
      reportState.learners=[];
      reportState.learnerId="";
      reportState.error="";
      reportState.rosterError="";
      loadReportLearners(target.value);
    }else if(key==="year"||key==="term"){
      e.stopImmediatePropagation();
      reportState[key]=target.value;
      reportState.data=null;
      reportState.error="";
      render();
    }
  },true);
   root.addEventListener("change",async e=>{
    const target=e.target;
     if(target.matches('input[name="comment-choice"]')){
       root.querySelectorAll("[data-comment-mode-panel]").forEach(panel=>{
         const active=panel.dataset.commentModePanel===target.value;
         panel.hidden=!active;
         panel.querySelectorAll("select,textarea").forEach(input=>{
           input.disabled=!active||(input.matches("select")&&input.dataset.hasOptions==="false");
         });
       });
       return;
     }
    if(target.id==="f-learner-photo"){await handleLearnerPhotoSelection(target);return}
    if(target.matches("[data-fin-balance-class]")){state.finance.feeBalanceClass=target.value;render();return}
    if(target.id==="fee-balance-csv"&&target.files?.[0]){
      await window.ReportCardsFinance?.handleFile?.(target.files[0],state,api,financeToast);
      target.value="";
      return;
    }
    if(target.matches("[data-feedback-status]")){
      await window.ReportCardsParentAdmin?.setFeedbackStatus?.(target.dataset.feedbackStatus,target.value,api,toast,()=>loadRoute("parent-feedback"));
    }
  });
  root.addEventListener("submit",async e=>{
    if(e.target.id==="announcement-form"){
      e.preventDefault();
      await window.ReportCardsParentAdmin?.publish?.(e.target,api,toast,()=>loadRoute("announcements"));
    }
  });
   root.addEventListener("click",e=>{const financeTab=e.target.closest("[data-fin-tab]");if(financeTab){e.preventDefault();state.finance.tab=financeTab.dataset.finTab;loadRoute("finance");return}const financeButton=e.target.closest("[data-fin-action]");if(financeButton){e.preventDefault();financeAction(financeButton);return}const link=e.target.closest("[data-route]");if(link){e.preventDefault();go(link.dataset.route);return}const btn=e.target.closest("[data-action]");if(btn)action(btn,e)});
    root.addEventListener("change",e=>{const target=e.target,mode=target.closest("[data-tr-mode]");if(mode){const row=mode.closest("tr"),selected=mode.value;row?.querySelectorAll("[data-tr-input]").forEach(input=>{input.hidden=input.dataset.trInput!==selected});const auto=row?.querySelector('[data-tr-panel="auto"]');if(auto)auto.hidden=selected!=="auto";if(selected==="auto"&&row)calculateMarks(row)}if(target.matches("[data-ple-subject]")){if(state.modal)state.modal.subjectId=target.value;render();return}if(target.matches("[data-overall-grade],[data-grade-point-type]"))calculateMarks(target.closest("tr"))});
  root.addEventListener("change",e=>{
    const target=e.target;
    if(target.matches("[data-mark-entry-level]")){
      state.filter.mark_entry_level=target.value;
      state.filter.class_id="";
      state.filter.subject_id="";
      state.data.marks=[];
      state.data.marksError="";
      state.rm.marks=null;
      state.rm.class=null;
      state.rm.subject=null;
      state.rm.submission=null;
      state.rm.error="";
      render();
      return;
    }
    if(target.matches('[data-filter="class_id"]')&&state.route==="marks"){
      const selected=(state.data.classes||[]).find(item=>String(item.id)===String(target.value));
      if(selected)state.filter.mark_entry_level=markClassGroup(selected)||state.filter.mark_entry_level;
    }
    if(target.matches('[data-rm-filter="class_id"]')&&state.route==="marks"&&state.role==="teacher"){
      const selected=(state.rm.classes||[]).find(item=>String(item.class_id)===String(target.value));
      if(selected)state.filter.mark_entry_level=markClassGroup(selected)||state.filter.mark_entry_level;
    }
  });
  root.addEventListener("change",e=>{const input=e.target.closest("[data-activity-icon-file]");if(input&&input.files?.[0])uploadNurseryActivityIcon(input)});
  root.addEventListener("input",e=>{updateLiveMarkInput(e.target);if(e.target.matches("[data-watermark-opacity]")){const output=root.querySelector("#watermark-opacity-value");if(output)output.textContent=`${e.target.value}%`}});
    root.addEventListener("change",e=>{const t=e.target;if(t.matches("[data-score],[data-mark-period-score]"))calculateMarks(t.closest("tr"));if(t.matches("[data-mark-period]")){state.filter.assessment_period=t.value;render()}if(t.matches("[data-filter]")){state.filter[t.dataset.filter]=t.value;if(t.dataset.filter==="class_id"&&state.route==="marks"){state.filter.subject_id="";loadRoute("marks")}else if(t.dataset.filter==="level"&&["subjects","grading"].includes(state.route)){state.filter.level=t.value;loadRoute(state.route)}}if(t.matches("[data-rm-filter]")){state.filter[t.dataset.rmFilter]=t.value;if(t.dataset.rmFilter==="class_id"){const first=(state.rm.classes||[]).find(c=>String(c.class_id)===String(t.value));state.filter.subject_id=first?.subject_id||""}if(state.route==="review")loadReviewQueue();else render()}if(t.matches("[data-report-filter]")){const key=t.dataset.reportFilter;if(key==="includeStamp"){reportState.includeStamp=t.checked;render()}else{reportState[key]=t.value;if(key==="template"||key==="period"){reportState.error="";if(reportState.data)loadReportClass();else render()}else if(key==="learnerId"){reportState.verificationError="";render();loadSelectedReportVerification()}else{reportState.verificationRequestId++;reportState.verifications={};reportState.verificationBusy=false;reportState.verificationError="";reportState.data=null;reportState.learners=[];reportState.learnerId="";reportState.error="";render()}}}if(t.matches("[data-fin-filter]")){state.finance[t.dataset.finFilter]=t.value;if(t.dataset.finFilter==="reportClass")state.finance.reportClass=t.value;loadRoute("finance")}if(t.matches("[data-signature-file]")&&t.files?.[0]){const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{const c=document.getElementById("signature-canvas"),ctx=c.getContext("2d");ctx.clearRect(0,0,c.width,c.height);const scale=Math.min(c.width/img.width,c.height/img.height);ctx.drawImage(img,(c.width-img.width*scale)/2,(c.height-img.height*scale)/2,img.width*scale,img.height*scale)};img.src=reader.result};reader.readAsDataURL(t.files[0])}if(t.id==="csv-file"&&t.files?.[0])importCsv(t.files[0]);if(t.id==="finance-csv"&&t.files?.[0])importFinanceCsv(t.files[0])});
  root.addEventListener("change",e=>{const filter=e.target.closest("[data-project-filter]");if(!filter)return;projectState[filter.dataset.projectFilter]=filter.value;projectState.error="";state.data.projectRegister=null;render()});
   root.addEventListener("change",e=>{const select=e.target.closest("[data-promotion-class]");if(select){state.rm.promotionClassId=select.value;loadReviewQueue()}});
    root.addEventListener("submit",async e=>{if(e.target.id==="auth-form"){e.preventDefault();await submitAuth(e.target)}else if(e.target.id==="command-center-provision-form"){e.preventDefault();await provisionSchool(e.target)}else if(e.target.id==="cc-sms-bundle-form"){e.preventDefault();await saveCommandCenterSmsBundle(e.target)}else if(e.target.id==="cc-sms-credit-form"){e.preventDefault();await addSchoolSmsCredits(e.target)}else if(e.target.id==="modal-form"){e.preventDefault();await handleModalSubmit(e.target)}else if(e.target.matches("[data-fin-form]")){e.preventDefault();await handleFinanceSubmit(e.target)}else if(e.target.id==="settings-form"){e.preventDefault();await saveSchoolSettings(e.target)}else if(e.target.id==="school-profile-form"){e.preventDefault();await saveSchoolProfile(e.target)}else if(e.target.id==="school-theme-form"){e.preventDefault();await saveSchoolTheme(e.target)}else if(e.target.id==="promotion-rules-form"){e.preventDefault();await savePromotionRules(e.target)}else if(e.target.id==="report-card-stamp-builder"){e.preventDefault();await saveStampSettings(e.target)}else if(e.target.id==="sms-test-form"){e.preventDefault();await submitSmsTest(e.target)}});
  root.addEventListener("submit",async e=>{if(e.target.id==="branding-settings-form"){e.preventDefault();await saveBrandingSettings(e.target)}});
   root.addEventListener("keydown",e=>{if(e.key==="Escape"&&root.querySelector(".marks-register-panel.is-fullscreen")){exitMarkFullscreen();return}if(e.key==="Escape"&&reportState.fullscreen){reportState.fullscreen=false;render();return}if(e.key==="Escape"&&state.modal){state.modal=null;render()}});
  root.addEventListener("keydown",e=>{if(e.key!=="Tab"||!state.modal)return;const modal=root.querySelector('[role="dialog"][aria-modal="true"]');if(!modal)return;const focusable=[...modal.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')];if(!focusable.length)return;const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}});
   root.addEventListener("input",e=>{if(e.target.id!=="cc-school-search")return;const start=e.target.selectionStart,end=e.target.selectionEnd;state.data.commandCenterSearch=e.target.value;render();const input=root.querySelector("#cc-school-search");input?.focus();if(input&&start!==null&&end!==null)input.setSelectionRange(start,end)});
  root.addEventListener("pointerdown",e=>{const c=e.target.closest("#signature-canvas");if(!c)return;drawing=true;lastPoint=canvasPoint(c,e);c.setPointerCapture?.(e.pointerId)});
  root.addEventListener("pointermove",e=>{const c=e.target.closest("#signature-canvas");if(!c||!drawing)return;const p=canvasPoint(c,e),ctx=c.getContext("2d");ctx.lineWidth=3;ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle="#35206f";ctx.beginPath();ctx.moveTo(lastPoint.x,lastPoint.y);ctx.lineTo(p.x,p.y);ctx.stroke();lastPoint=p});
  root.addEventListener("pointerup",()=>{drawing=false;lastPoint=null});root.addEventListener("pointercancel",()=>{drawing=false;lastPoint=null});
  root.addEventListener("keydown",e=>{const c=e.target.closest("#signature-canvas");if(!c||!["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key))return;e.preventDefault();const ctx=c.getContext("2d"),x=c.width/2,y=c.height/2;ctx.lineWidth=3;ctx.lineCap="round";ctx.strokeStyle=e.shiftKey?"#ffffff":"#35206f";ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(e.key==="ArrowRight"?14:e.key==="ArrowLeft"?-14:0),y+(e.key==="ArrowDown"?14:e.key==="ArrowUp"?-14:0));ctx.stroke()});
  window.addEventListener("resize",()=>requestAnimationFrame(applyPreviewScale));
  async function provisionSchool(form){
    if(state.role!=="super_admin"||!form.reportValidity())return;
    const initialPassword=form.querySelector('[name="initial_password"]')?.value||"";
    if(initialPassword.length<14||!/[a-z]/u.test(initialPassword)||!/[A-Z]/u.test(initialPassword)||!/\d/u.test(initialPassword)||!/[^A-Za-z0-9]/u.test(initialPassword)){
      document.getElementById("command-center-form-error").innerHTML='<div class="alert error">Use at least 14 characters with uppercase and lowercase letters, a number, and a symbol.</div>';
      return;
    }
    const body=Object.fromEntries(new FormData(form).entries());
    const button=form.querySelector('[type="submit"]');
    state.data.provisioningSchool=true;
    if(button){button.disabled=true;button.textContent="Creating…"}
    document.getElementById("command-center-form-error").innerHTML="";
    try{
      const result=await api("/api/command-center/schools",{method:"POST",body});
      state.data.provisioningSchool=false;
      form.reset();
      state.modal=null;
      await loadRoute("command-center");
      toast(`${result.school?.name||"School"} provisioned${result.school?.short_code?` · ${result.school.short_code}`:""}. The admin must change the temporary password at first login.`);
    }catch(error){
      state.data.provisioningSchool=false;
      const target=document.getElementById("command-center-form-error");
      if(target)target.innerHTML=`<div class="alert error" role="alert">${esc(error.message)}</div>`;
      if(button){button.disabled=false;button.innerHTML=`${icon("fa-school")} Create school`}
    }
  }
  async function submitAuth(form){
    if(!form.reportValidity())return;state.loading=true;renderAuth();
    const values=Object.fromEntries(new FormData(form).entries());
    try{
      const result=await api("/api/auth/login",{method:"POST",auth:false,body:values});
      state.token=result.token;localStorage.setItem(TOKEN_KEY,state.token);localStorage.removeItem("appshule_reportcards_parent_jwt");state.authMode="login";
      if(result.role==="parent"){location.assign("/parent-dashboard.html");return}
      else{
        state.user=result.user||null;state.school=result.school||null;state.role=result.role||result.user?.finance_role||result.user?.role||"school_admin";state.mustChangePassword=result.must_change_password===true;
        if(result.user){const me=await api("/api/auth/me");state.user=me.user||state.user;state.school=me.school||null;state.role=me.role||state.role;state.mustChangePassword=me.must_change_password===true}
      }
      state.modal=null;
      state.route=state.role==="super_admin"?"command-center":["bursar","head_teacher","director"].includes(state.role)?"finance":"dashboard";
      if(state.route==="finance")state.finance.tab="overview";
      state.loading=false;
      if(requestedPath==="/"||requestedPath==="/login"||requestedPath==="/signup")history.replaceState(null,"",`/${state.route}`);
      if(location.hash!==`#${state.route}`)location.hash=state.route;
      render();if(!state.mustChangePassword)await loadRoute(state.route)
    }
    catch(error){state.loading=false;state.token="";state.user=null;state.school=null;localStorage.removeItem(TOKEN_KEY);renderAuth();document.getElementById("auth-error").innerHTML=`<div class="alert error" role="alert">${esc(error.message)}</div>`}
  }
  window.addEventListener("hashchange",()=>{if(!state.token&&requestedPath==="/"&&!root.querySelector(".asl-landing")){state.authMode="login";render();return}const route=location.hash.replace(/^#\/?/u,"");if(navItems.some(x=>x[0]===route)&&state.token&&state.route!==route)go(route)});
  const pathRoute=requestedPath.slice(1);
  if(navItems.some(x=>x[0]===pathRoute))state.route=pathRoute;
  if(location.hash&&navItems.some(x=>x[0]===location.hash.slice(1)))state.route=location.hash.slice(1);
  render();verifySession();
})();
