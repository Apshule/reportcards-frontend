(() => {
  "use strict";
  const API = "https://reportcards-api.apshule-migration.workers.dev";
  const TOKEN_KEY = "appshule_reportcards_school_jwt";
  const LEVELS = [["NURSERY","Nursery"],["PRIMARY","Primary"],["O_LEVEL","O Level"],["A_LEVEL","A Level"]];
  const navItems = [
    ["dashboard","Dashboard","fa-house"],["classes","Classes","fa-chalkboard"],["learners","Learners","fa-user-graduate"],
    ["subjects","Subjects","fa-book-open"],["grading","Grading","fa-scale-balanced"],["teachers","Teachers","fa-chalkboard-user"],
    ["marks","Marks","fa-pen-to-square"],["projects","A-Level projects","fa-flask"],["reports","Report cards","fa-file-lines"],
    ["finance","Finance","fa-coins"],["settings","School settings","fa-calendar-days"],["review","Marks review","fa-clipboard-check"]
  ];
  const state = {token:localStorage.getItem(TOKEN_KEY)||"",school:null,user:null,role:"school_admin",mustChangePassword:false,route:"dashboard",loading:false,modal:null,toast:null,filter:{level:"",class_id:"",subject_id:"",academic_year:String(new Date().getFullYear()),term:"TERM_1",search:""},data:{},authMode:"login",finance:{tab:"overview",term:"TERM_1",year:String(new Date().getFullYear()),loading:false,error:"",data:{},incomeFilters:{},expenseFilters:{},schoolpayFilters:{},reportClass:""},rm:{classes:null,marks:null,submission:null,comments:{},signature:null,review:null,reviewBusy:false}};
  const reportState = {classId:"",learnerId:"",term:"TERM_1",year:String(new Date().getFullYear()),data:null,learners:[],busy:false,error:""};
  const projectState = {classId:"",term:"TERM_1",year:String(new Date().getFullYear()),data:null,busy:false,error:""};
  const root = document.getElementById("app");
  let schoolpayTimer=null;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const icon = name => `<i class="fa-solid ${name}" aria-hidden="true"></i>`;
  const levelLabel = level => LEVELS.find(x=>x[0]===level)?.[1]||level||"—";
  const isALevel = level => /^(ALEVEL|S[56])/.test(String(level||"").toUpperCase().replace(/[^A-Z0-9]/g,""));
  const fmt = value => value===null||value===undefined||value===""?"—":esc(value);
  const idOf = item => item?.id ?? "";
  function toast(message,kind="success"){state.toast={message,kind};render();setTimeout(()=>{state.toast=null;render()},4000)}
  function schoolName(){return state.school?.name||state.school?.school_name||"School office"}
  function hasFinanceAccess(){return ["school_admin","bursar","head_teacher","director"].includes(state.role)}
  function visibleNavItems(){if(state.role==="teacher")return navItems.filter(item=>["dashboard","marks"].includes(item[0]));return ["bursar","head_teacher","director"].includes(state.role)?navItems.filter(item=>item[0]==="finance"):navItems.filter(item=>(item[0]!=="finance"||state.role==="school_admin")&&(item[0]!=="settings"||state.role==="school_admin")&&(item[0]!=="reports"||state.role==="school_admin")&&(item[0]!=="review"||state.role==="school_admin"))}
  async function api(path,{method="GET",body,auth=true}={}){
    const headers={"Content-Type":"application/json"};
    if(auth&&state.token)headers.Authorization=`Bearer ${state.token}`;
    let response;
    try { response=await fetch(API+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}); }
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
      if(me.type==="school"&&me.school){state.school=me.school;state.user=null;state.role="school_admin";state.mustChangePassword=false;state.route="dashboard";render();await loadDashboard();return}
      if(me.type==="user"&&me.user){state.user=me.user;state.school=me.school||null;state.role=me.role||me.user.finance_role||me.user.role||"teacher";state.mustChangePassword=me.must_change_password===true;state.route=hasFinanceAccess()?"finance":"dashboard";if(state.route==="finance")state.finance.tab="overview";state.modal=null;render();if(!state.mustChangePassword)await loadRoute(state.route);return}
      throw new Error("Account details were unavailable.");
    }catch{state.token="";state.school=null;state.user=null;state.role="school_admin";state.mustChangePassword=false;state.modal=null;localStorage.removeItem(TOKEN_KEY);render()}
  }
  function logout(show=true){state.token="";state.school=null;state.user=null;state.role="school_admin";state.mustChangePassword=false;state.data={};state.finance.data={};state.loading=false;localStorage.removeItem(TOKEN_KEY);state.route="dashboard";state.modal=null;configureFinancePolling();render();if(show)toast("You have signed out.");}
  function go(route){if(state.mustChangePassword)return;if(route==="finance"&&!hasFinanceAccess())return;if((route==="settings"||route==="reports"||route==="review")&&state.role!=="school_admin")return;if(state.role==="teacher"&&!["dashboard","marks"].includes(route))return;if(["bursar","head_teacher","director"].includes(state.role)&&route!=="finance")return;state.route=route;state.modal=null;configureFinancePolling();if(location.hash!==`#${route}`)location.hash=route;document.querySelector(".sidebar")?.classList.remove("open");document.querySelector(".sidebar-scrim")?.remove();render();loadRoute(route)}
  function shell(content){
    const routeName=navItems.find(n=>n[0]===state.route)?.[1]||"Dashboard";
    const actorRole=state.role==="school_admin"?"Administrator":state.role.replaceAll("_"," ");
    return `<div class="app-shell"><aside class="sidebar" id="sidebar"><div class="brand"><span class="brand-mark"></span>appshule</div><div class="nav-label">School office</div><nav class="nav-list" aria-label="Main navigation">${visibleNavItems().map(([route,label,ico])=>`<a class="nav-link ${state.route===route?"active":""}" href="#${route}" data-route="${route}" ${state.route===route?'aria-current="page"':""}>${icon(ico)}<span>${label}</span></a>`).join("")}</nav><div class="sidebar-bottom"><div class="school-chip"><div class="school-avatar">${esc(schoolName().slice(0,1).toUpperCase())}</div><div class="school-info"><strong>${esc(schoolName())}</strong><span>${esc(actorRole)}</span></div></div><button class="btn logout" data-action="logout">${icon("fa-arrow-right-from-bracket")} Sign out</button></div></aside><main class="main"><header class="topbar"><div class="topbar-left"><button class="menu-toggle" aria-label="Open navigation" data-action="menu">${icon("fa-bars")}</button><span class="crumb">School office / <strong>${esc(routeName)}</strong></span></div><span class="topbar-date">${new Date().toLocaleDateString("en-UG",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</span></header><section class="page">${content}</section></main>${state.modal?modalMarkup():""}${state.toast?`<div class="toast ${state.toast.kind}" role="status">${icon(state.toast.kind==="error"?"fa-circle-exclamation":"fa-circle-check")} ${esc(state.toast.message)}</div>`:""}</div>`;
  }
  function heading(title,subtitle,action=""){return `<div class="page-heading"><div><p class="eyebrow">AppShule · School office</p><h1>${title}</h1><p>${subtitle}</p></div>${action?`<div class="page-actions">${action}</div>`:""}</div>`}
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
      else if(route==="marks"&&state.role==="teacher"){await loadTeacherClasses();if(state.filter.class_id&&state.filter.subject_id)await loadTeacherMarks()}
       else if(route==="classes"){state.data.classes=null;render();const [classes,teachers]=await Promise.all([api("/api/classes"),api("/api/teachers")]);state.data.classes=classes.classes||[];state.data.teachers=teachers.teachers||[];}
      else if(route==="learners"){state.data.classes=state.data.classes||((await api("/api/classes")).classes||[]);state.data.learners=null;render();const q=new URLSearchParams();if(state.filter.class_id)q.set("class_id",state.filter.class_id);if(state.filter.search)q.set("search",state.filter.search);state.data.learners=(await api("/api/learners?"+q)).learners||[];}
      else if(route==="subjects"){state.data.subjects=null;render();let q=state.filter.level?`?level=${encodeURIComponent(state.filter.level)}`:"";state.data.subjects=(await api("/api/subjects"+q)).subjects||[];}
      else if(route==="grading"){state.data.grading=null;render();let q=state.filter.level?`?level=${encodeURIComponent(state.filter.level)}`:"";state.data.grading=(await api("/api/grading"+q)).grading||[];}
      else if(route==="teachers"){state.data.teachers=null;render();state.data.teachers=(await api("/api/teachers")).teachers||[];state.data.classes=(await api("/api/classes")).classes||[];state.data.subjects=(await api("/api/subjects")).subjects||[];}
      else if(route==="marks"){state.data.classes=state.data.classes||((await api("/api/classes")).classes||[]);state.data.subjects=state.data.subjects||((await api("/api/subjects")).subjects||[]);await loadMarks()}
      else if(route==="projects"){state.data.classes=state.data.classes||((await api("/api/classes")).classes||[]);if(!projectState.classId)projectState.classId=state.data.classes.find(c=>isALevel(c.level))?.id||"";await loadProjectRegister()}
      else if(route==="projects"){state.data.classes=state.data.classes||((await api("/api/classes")).classes||[]);if(!projectState.classId)projectState.classId=state.data.classes.find(c=>isALevel(c.level))?.id||"";await loadProjectRegister()}
      else if(route==="reports"){state.data.classes=state.data.classes||((await api("/api/classes")).classes||[]);if(!reportState.classId&&state.data.classes.length)reportState.classId=state.data.classes[0].id;}
      else if(route==="finance"){if(!hasFinanceAccess())throw new Error("Finance access is not assigned to this account.");await loadFinanceTab()}
      else if(route==="settings"){if(state.role!=="school_admin")throw new Error("School settings are only available to school administrators.");state.data.schoolSettings=null;state.data.settingsError=null;render();state.data.schoolSettings=(await api("/api/school/me")).school||null;}
      else if(route==="review"&&state.role==="school_admin")await loadReviewQueue();
    }catch(error){state.data[route+"Error"]=error.message}
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
    const q=new URLSearchParams({class_id:state.filter.class_id,subject_id:state.filter.subject_id,academic_year:state.filter.academic_year,term:state.filter.term});
    try{
      const level=(state.data.classes||[]).find(c=>String(c.id)===String(state.filter.class_id))?.level;
      const [marks,grading]=await Promise.all([api("/api/marks?"+q),api("/api/grading"+(level?`?level=${encodeURIComponent(level)}`:""))]);
      state.data.marks=marks.marks||[];state.data.grading=grading.grading||[];
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
    if(!data)return `${heading("Good morning","Your school at a glance.")}${err?errorBox(err,"dashboard"):`${loading()}`}`;
    const s=data.stats||{};
    const recent=data.recent_learners||[];
    return `${heading(`Welcome, ${esc(state.school?.head_teacher_name||state.school?.name||"Administrator")}`, "Here is the latest from your school.")}<div class="stats-grid">${metric("Classes",s.classes,"fa-chalkboard","Active classes")}${metric("Learners",s.learners,"fa-user-graduate","On your register")}${metric("Subjects",s.subjects,"fa-book-open","Across levels")}${metric("Teachers",s.teachers,"fa-chalkboard-user","On your staff")}</div><div class="content-grid"><section class="card section-card"><div class="section-title"><div><h2>Recently added learners</h2><p>New additions to your school register</p></div><a class="text-button" href="#learners" data-route="learners">View learners</a></div>${recent.length?`<div class="table-wrap"><table><thead><tr><th>Learner</th><th>Registration no.</th><th>Class</th></tr></thead><tbody>${recent.slice(0,6).map(l=>`<tr><td class="row-primary">${esc(l.full_name)}</td><td>${fmt(l.reg_no)}</td><td>${fmt(l.class_name)}</td></tr>`).join("")}</tbody></table></div>`:empty("Your register starts here","Once you add learners, your recent activity will appear here.",button("Add learners","add-learner","fa-user-plus"))}</section><section class="card section-card"><div class="section-title"><div><h2>Quick actions</h2><p>Keep the school day moving</p></div></div><div class="quick-grid"><a class="quick-link" href="#classes" data-route="classes">${icon("fa-chalkboard")} Add a class</a><a class="quick-link" href="#learners" data-route="learners">${icon("fa-user-plus")} Register learners</a><a class="quick-link" href="#marks" data-route="marks">${icon("fa-pen-to-square")} Enter marks</a><a class="quick-link" href="#teachers" data-route="teachers">${icon("fa-user-tie")} Manage teachers</a></div></section></div>`;
  }
  async function loadTeacherClasses(){
    const rm=state.rm;rm.classes=null;rm.error="";rm.signatureStatus={text:"Loading saved signature…",kind:"success"};render();
    try{const result=await api("/api/rm/my-classes");rm.classes=result.classes||[];if(rm.classes.length&&!rm.classes.some(c=>String(c.class_id)===String(state.filter.class_id)&&String(c.subject_id||"")===String(state.filter.subject_id||""))){state.filter.class_id=String(rm.classes[0].class_id);state.filter.subject_id=String(rm.classes[0].subject_id||"")}try{rm.signature=(await api("/api/rm/teachers/signature")).signature||null;rm.signatureStatus=null}catch(error){rm.signature=null;rm.signatureStatus={text:`Could not load saved signature: ${error.message}`,kind:"error"}}}catch(error){rm.error=error.message}
    render();
  }
  function teacherDashboard(){
    const assigned=state.rm.classes||[];
     return `${heading(`Welcome${state.user?.name?`, ${esc(state.user.name)}`:""}`,"Your assigned classes and learning areas, ready for the next assessment.")}${state.rm.error?errorBox(state.rm.error,"marks"):""}<section class="card section-card teacher-welcome"><div><span class="eyebrow">Teaching workspace</span><h2>${assigned.length} assigned ${assigned.length===1?"class":"class and subject pair"}${assigned.length===1?"":"s"}</h2><p>Marks and learner comments stay limited to your teaching assignments.</p></div><button class="btn btn-primary" data-route="marks">${icon("fa-pen-to-square")} Enter marks</button></section><section class="assigned-grid">${assigned.length?assigned.map(c=>`<article class="card assignment-card"><div class="assignment-icon">${icon("fa-book-open")}</div><div><span class="badge">${esc(levelLabel(c.level))}</span><h3>${esc(c.class_name)}</h3><p>${esc(c.subject_name||"Class teacher comments")}${c.is_class_teacher?' · Class teacher':""}</p></div><button class="btn btn-quiet" data-action="open-assigned" data-class="${esc(c.class_id)}" data-subject="${esc(c.subject_id||"")}">${c.subject_id?"Open register":"Open class comments"} ${icon("fa-arrow-right")}</button></article>`).join(""):state.rm.classes===null?loading():empty("No teaching assignments yet","Ask your school administrator to assign your classes and subjects.")}</section>${signaturePanel()}`;
  }
  function periodQuery(){return new URLSearchParams({subject_id:state.filter.subject_id,term:state.filter.term,year:String(state.filter.academic_year)}).toString()}
  async function loadTeacherMarks(){
    const rm=state.rm;rm.marks=null;rm.error="";render();
     try{const result=await api(`/api/rm/class/${encodeURIComponent(state.filter.class_id)}/marks?${periodQuery()}`);rm.marks=result.learners||[];rm.class=result.class;rm.subject=result.subject;rm.submission=result.submission||null;rm.comments=Object.fromEntries(rm.marks.map(learner=>[learner.learner_id,learner.class_teacher_comment||""]))}catch(error){rm.error=error.message}
    render();
  }
   function signaturePanel(){const sig=state.rm.signature;return `<section class="card section-card signature-card"><div class="section-title"><div><h2>Teacher signature</h2><p>Upload a signature image or draw one below. Saved for your account.</p></div></div>${state.rm.signatureStatus?`<div class="alert ${state.rm.signatureStatus.kind}" role="status">${esc(state.rm.signatureStatus.text)}</div>`:""}${sig?.data_url?`<img class="signature-preview" src="${esc(sig.data_url)}" alt="Saved teacher signature">`:""}<div class="signature-tools"><label class="btn btn-outline upload-signature">${icon("fa-upload")} Upload image<input type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" data-signature-file></label><button class="btn btn-quiet" data-action="clear-signature">${icon("fa-eraser")} Clear canvas</button><button class="btn btn-primary" data-action="save-signature">${icon("fa-floppy-disk")} Save signature</button></div><canvas id="signature-canvas" width="600" height="160" aria-label="Signature drawing canvas" tabindex="0" role="application"></canvas><p class="field-hint">Draw with pointer or touch. Keyboard: focus the canvas, then use arrow keys to draw; hold Shift to erase.</p></section>`}
  function teacherMarksPage(){
     const list=state.rm.classes||[],matching=list.filter(c=>String(c.class_id)===String(state.filter.class_id)),subjects=matching.filter(c=>c.subject_id);
    const aLevel=matching.some(c=>isALevel(c.level));
    const classOptions=list.filter((c,i,a)=>a.findIndex(x=>String(x.class_id)===String(c.class_id))===i).map(c=>`<option value="${esc(c.class_id)}" ${String(c.class_id)===String(state.filter.class_id)?"selected":""}>${esc(c.class_name)}</option>`).join("");
     const isClassTeacher=matching.some(c=>c.is_class_teacher);
     const subjectOptions=`${isClassTeacher?`<option value="" ${!state.filter.subject_id?"selected":""}>Class teacher comments</option>`:""}${subjects.map(c=>`<option value="${esc(c.subject_id)}" ${String(c.subject_id)===String(state.filter.subject_id)?"selected":""}>${esc(c.subject_name)}</option>`).join("")}`;
     const commentOnly=isClassTeacher&&!state.filter.subject_id;
    const learners=state.rm.marks||[];
     const actions=commentOnly?"":`<button class="btn btn-outline" data-action="save-teacher-marks" ${!learners.length?"disabled":""}>${icon("fa-floppy-disk")} Save draft</button><button class="btn btn-primary" data-action="submit-marks-review" ${!learners.length||["submitted","reviewed","published"].includes(state.rm.submission?.status)?"disabled":""}>${icon("fa-paper-plane")} Submit for review</button>`;
     const content=commentOnly?`<div class="table-wrap"><table><thead><tr><th>Learner</th><th>Class-teacher comment</th><th></th></tr></thead><tbody>${learners.map(m=>`<tr><td><strong>${esc(m.full_name)}</strong><span class="row-sub">${esc(m.reg_no||"")}</span></td><td><textarea data-comment="${esc(m.learner_id)}" maxlength="1500" aria-label="Class-teacher comment for ${esc(m.full_name)}">${esc(state.rm.comments[m.learner_id]||"")}</textarea></td><td><button class="btn btn-quiet btn-small" data-action="save-comment" data-learner="${esc(m.learner_id)}">Save comment</button><span data-comment-state="${esc(m.learner_id)}" role="status"></span></td></tr>`).join("")}</tbody></table></div>`:`<div class="formula-note">AVG = (A1 + A2 + A3) ÷ 3 · 20% + 80% = final result. Identifier and grade are calculated live.</div><div class="table-wrap marks-mobile-wrap"><table id="teacher-marks-table"><thead><tr><th>Learner</th><th>A1 / 3</th><th>A2 / 3</th><th>A3 / 3</th><th>AVG</th><th>20%</th><th>EOT / 100</th><th>80%</th><th>100%</th><th>Identifier</th><th>Grade</th>${aLevel?"<th>Paper</th>":""}<th>Initials</th></tr></thead><tbody>${learners.map(m=>`<tr data-learner="${esc(m.learner_id)}"><td><strong>${esc(m.full_name)}</strong><span class="row-sub">${esc(m.reg_no||"")}</span></td>${[["a1",3],["a2",3],["a3",3],["eot",100]].map(([k,max])=>`<td><input class="mark-input" type="number" min="0" max="${max}" step=".01" value="${m[k]??""}" data-score="${k}" aria-label="${esc(m.full_name)} ${k.toUpperCase()}"></td>`).slice(0,3).join("")}<td data-result="avg">${fmt(m.avg)}</td><td data-result="pct20">${fmt(m.pct20)}</td><td><input class="mark-input" type="number" min="0" max="100" step=".01" value="${m.eot??""}" data-score="eot" aria-label="${esc(m.full_name)} EOT"></td><td data-result="pct80">${fmt(m.pct80)}</td><td class="mark-total" data-result="pct100">${fmt(m.pct100)}</td><td data-result="identifier">${fmt(m.identifier)}</td><td data-result="grade">${fmt(m.grade)}</td>${aLevel?`<td><input class="mark-input" type="number" min="1" max="20" step="1" value="${m.paper_number??""}" data-score="paper_number" aria-label="${esc(m.full_name)} paper number"></td>`:""}<td><input class="mark-input initials-input" maxlength="30" value="${esc(m.teacher_initials||"")}" data-initials aria-label="${esc(m.full_name)} teacher initials"></td></tr>${isClassTeacher?`<tr class="comment-row"><td colspan="${aLevel?13:12}"><label for="comment-${esc(m.learner_id)}">Class-teacher comment · ${esc(m.full_name)}</label><textarea id="comment-${esc(m.learner_id)}" data-comment="${esc(m.learner_id)}" maxlength="1500">${esc(state.rm.comments[m.learner_id]||"")}</textarea><button class="btn btn-quiet btn-small" data-action="save-comment" data-learner="${esc(m.learner_id)}">Save comment</button><span data-comment-state="${esc(m.learner_id)}" role="status"></span></td></tr>`:""}`).join("")}</tbody></table></div>`;
     return `${heading(commentOnly?"Class-teacher comments":"Marks register",commentOnly?"Add comments for learners in your assigned class.":"Enter CBC continuous assessment and end-of-term marks.",actions)}<section class="card section-card"><div class="period-bar"><div class="field"><label for="rm-class">Assigned class</label><select id="rm-class" data-rm-filter="class_id">${classOptions}</select></div><div class="field"><label for="rm-subject">Assigned subject</label><select id="rm-subject" data-rm-filter="subject_id" ${!subjects.length?"disabled":""}>${subjectOptions}</select></div><div class="field"><label for="rm-year">Academic year</label><input id="rm-year" type="number" min="2000" max="2100" value="${esc(state.filter.academic_year)}" data-rm-filter="academic_year"></div><div class="field"><label for="rm-term">Term</label><select id="rm-term" data-rm-filter="term">${["TERM_1","TERM_2","TERM_3"].map(t=>`<option value="${t}" ${t===state.filter.term?"selected":""}>${t.replace("_"," ")}</option>`).join("")}</select></div><button class="btn btn-quiet" data-action="load-teacher-marks">${icon("fa-arrow-right")} Load ${commentOnly?"learners":"register"}</button></div>${state.rm.submission?`<p class="submission-status"><span class="badge">${esc(state.rm.submission.status)}</span>${state.rm.submission.submitted_at?` Submitted ${esc(new Date(state.rm.submission.submitted_at).toLocaleString("en-UG"))}`:""}</p>`:""}</section>${state.rm.error?errorBox(state.rm.error,"marks"):""}<section class="card section-card"><div class="section-title"><div><h2>${esc(state.rm.class?.name||"Assessment register")}${state.rm.subject?.name?` · ${esc(state.rm.subject.name)}`:""}</h2><p>${commentOnly?"Comments can be updated by the assigned class teacher.":"A1–A3 are out of 3; EOT is out of 100. Calculations update as you type."}</p></div></div>${!state.filter.class_id?empty("No assigned class","Your administrator can assign classes and subjects."):state.rm.marks===null?loading():learners.length?content:empty("No learners in this class","The assigned class has no active learners.")}</section>${signaturePanel()}`;
  }
  async function loadReviewQueue(){state.rm.review=null;state.rm.error="";render();try{const q=new URLSearchParams({term:state.filter.term,year:String(state.filter.academic_year)});state.rm.review=(await api(`/api/rm/review-queue?${q}`)).submissions||[]}catch(e){state.rm.error=e.message}render()}
   function reviewPage(){
     const rows=state.rm.review||[];
     const actions=x=>`${x.status==="published"?"":`<button class="btn btn-outline btn-small" data-action="view-submission" data-id="${esc(x.id)}">View / edit</button>`}${x.status==="submitted"?`<button class="btn btn-primary btn-small" data-action="approve-submission" data-id="${esc(x.id)}">Approve</button><button class="btn btn-quiet btn-small" data-action="return-submission" data-id="${esc(x.id)}">Return</button>`:""}${x.status==="reviewed"?`<button class="btn btn-accent btn-small" data-action="publish-submission" data-id="${esc(x.id)}">Publish</button>`:""}`;
     return `${heading("Marks review","Review submitted class and subject registers before publishing results.")}<section class="card section-card"><div class="toolbar"><label>Term<select data-rm-filter="term">${["TERM_1","TERM_2","TERM_3"].map(t=>`<option value="${t}" ${state.filter.term===t?"selected":""}>${t.replace("_"," ")}</option>`).join("")}</select></label><label>Year<input type="number" data-rm-filter="academic_year" value="${esc(state.filter.academic_year)}"></label><button class="btn btn-quiet" data-action="load-review">${icon("fa-rotate")} Refresh queue</button></div>${state.rm.error?errorBox(state.rm.error,"review"):state.rm.review===null?loading():rows.length?`<div class="table-wrap"><table><thead><tr><th>Class</th><th>Subject</th><th>Teacher</th><th>Period</th><th>Submitted</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows.map(x=>`<tr><td><strong>${esc(x.class_name||"—")}</strong></td><td>${esc(x.subject_name||"—")}</td><td>${esc(x.submitted_by_name||"—")}</td><td>${esc(x.term||state.filter.term)} · ${esc(x.year||state.filter.academic_year)}</td><td>${fmt(x.submitted_at?new Date(x.submitted_at).toLocaleDateString("en-UG"):"")}</td><td><span class="badge">${esc(x.status)}</span></td><td class="review-actions">${actions(x)}</td></tr>`).join("")}</tbody></table></div>`:empty("Review queue is clear","Submissions for this term will appear here.")}</section>`;
   }
   function classOptions(selected="",includeBlank=true){const arr=state.data.classes||[];return `${includeBlank?'<option value="">Choose a class</option>':""}${arr.map(c=>`<option value="${esc(c.id)}" ${String(c.id)===String(selected)?"selected":""}>${esc(c.name)}${c.stream?` · ${esc(c.stream)}`:""}</option>`).join("")}`}
   function classTeacherOptions(selected=""){return `<option value="">No class teacher</option>${(state.data.teachers||[]).filter(t=>t.teacher_type==="class_teacher").map(t=>`<option value="${esc(t.id)}" ${String(t.id)===String(selected)?"selected":""}>${esc(t.name)}</option>`).join("")}`}
  function projectClassOptions(selected=""){return `${(state.data.classes||[]).filter(c=>isALevel(c.level)).map(c=>`<option value="${esc(c.id)}" ${String(c.id)===String(selected)?"selected":""}>${esc(c.name)}${c.stream?` · ${esc(c.stream)}`:""}</option>`).join("")}`}
  function levelOptions(selected="",includeAll=false){return `${includeAll?'<option value="">All levels</option>':""}${LEVELS.map(([v,l])=>`<option value="${v}" ${selected===v?"selected":""}>${l}</option>`).join("")}`}
  function classesPage(){const data=state.data.classes;return `${heading("Classes","Organise your school by level and stream.",button("Add class","add-class","fa-plus"))}${state.data.classesError?errorBox(state.data.classesError,"classes"):""}<section class="card section-card"><div class="section-title"><div><h2>Your classes</h2><p>${data?.length??"—"} classes in this school</p></div></div>${data===null||data===undefined?loading():data.length?`<div class="table-wrap"><table><thead><tr><th>Class</th><th>Level</th><th>Stream</th><th>Average age</th><th></th></tr></thead><tbody>${data.map(c=>`<tr><td class="row-primary">${esc(c.name)}</td><td><span class="badge">${esc(levelLabel(c.level))}</span></td><td>${fmt(c.stream)}</td><td>${fmt(c.avg_age)}</td><td><div class="actions"><button class="icon-btn" aria-label="Edit ${esc(c.name)}" data-action="edit-class" data-id="${esc(c.id)}">${icon("fa-pen")}</button><button class="icon-btn delete" aria-label="Delete ${esc(c.name)}" data-action="delete-class" data-id="${esc(c.id)}">${icon("fa-trash")}</button></div></td></tr>`).join("")}</tbody></table></div>`:empty("No classes yet","Add your first class to begin registering learners.",button("Add class","add-class"))}</section>`}
   function learnersPage(){const data=state.data.learners;const action=`<button class="btn btn-outline" data-action="import-csv">${icon("fa-file-csv")} Import CSV</button>${button("Add learner","add-learner","fa-user-plus")}`;return `${heading("Learners","A clear, current register for every class.",action)}${state.data.learnersError?errorBox(state.data.learnersError,"learners"):""}<section class="card section-card"><div class="toolbar"><label class="sr-only" for="learner-search">Search learners</label><input id="learner-search" placeholder="Search name or registration no." value="${esc(state.filter.search)}" data-filter="search"><label class="sr-only" for="learner-class-filter">Filter by class</label><select id="learner-class-filter" data-filter="class_id">${classOptions(state.filter.class_id)}</select><button class="btn btn-quiet" data-action="apply-learners">${icon("fa-magnifying-glass")} Search</button></div>${data===null||data===undefined?loading():data.length?`<div class="table-wrap"><table><thead><tr><th>Learner</th><th>Reg. no.</th><th>Class</th><th>Gender</th><th>Parent / guardian</th><th></th></tr></thead><tbody>${data.map(l=>`<tr><td class="row-primary"><button class="learner-name-button" type="button" data-action="view-learner" data-id="${esc(l.id)}">${esc(l.full_name)}</button></td><td>${fmt(l.reg_no)}</td><td>${esc((state.data.classes||[]).find(c=>c.id===l.class_id)?.name||"—")}</td><td>${fmt(l.gender)}</td><td>${fmt(l.parent_name)}</td><td><div class="actions"><button class="icon-btn" aria-label="Edit ${esc(l.full_name)}" data-action="edit-learner" data-id="${esc(l.id)}">${icon("fa-pen")}</button><button class="icon-btn delete" aria-label="Delete ${esc(l.full_name)}" data-action="delete-learner" data-id="${esc(l.id)}">${icon("fa-trash")}</button></div></td></tr>`).join("")}</tbody></table></div>`:empty("No learners found","Try another search, or add a learner to this register.",button("Add learner","add-learner","fa-user-plus"))}</section><input type="file" id="csv-file" accept=".csv,text/csv" class="hidden" aria-label="Choose learner CSV file">`}
  function subjectsPage(){const data=state.data.subjects;const actions=`<button class="btn btn-outline" data-action="seed-subjects">${icon("fa-wand-magic-sparkles")} Add defaults</button>${button("Add subject","add-subject")}`;return `${heading("Subjects","Set up the learning areas taught at each level.",actions)}${state.data.subjectsError?errorBox(state.data.subjectsError,"subjects"):""}<section class="card section-card"><div class="toolbar"><label class="sr-only" for="subject-level">Filter subjects by level</label><select id="subject-level" data-filter="level">${levelOptions(state.filter.level,true)}</select><button class="btn btn-quiet" data-action="apply-level-subjects">Apply filter</button></div>${data===null||data===undefined?loading():data.length?`<div class="table-wrap"><table><thead><tr><th>Subject</th><th>Level</th><th>Code</th><th>Papers</th><th></th></tr></thead><tbody>${data.map(s=>`<tr><td class="row-primary">${esc(s.name)}</td><td><span class="badge">${esc(levelLabel(s.level))}</span></td><td>${fmt(s.code)}</td><td>${fmt(s.papers)}</td><td><div class="actions"><button class="icon-btn" aria-label="Edit ${esc(s.name)}" data-action="edit-subject" data-id="${esc(s.id)}">${icon("fa-pen")}</button><button class="icon-btn delete" aria-label="Delete ${esc(s.name)}" data-action="delete-subject" data-id="${esc(s.id)}">${icon("fa-trash")}</button></div></td></tr>`).join("")}</tbody></table></div>`:empty("No subjects for this level","Create a subject or add the API's standard defaults.",actions)}</section>`}
  function gradingPage(){const data=state.data.grading;const actions=`<button class="btn btn-outline" data-action="seed-grading">${icon("fa-wand-magic-sparkles")} Add defaults</button>${button("Add grade","add-grade")}`;return `${heading("Grading scale","Define the score bands used when marks are calculated.",actions)}${state.data.gradingError?errorBox(state.data.gradingError,"grading"):""}<section class="card section-card"><div class="toolbar"><label class="sr-only" for="grading-level">Filter grades by level</label><select id="grading-level" data-filter="level">${levelOptions(state.filter.level,true)}</select><button class="btn btn-quiet" data-action="apply-level-grading">Apply filter</button></div>${data===null||data===undefined?loading():data.length?`<div class="table-wrap"><table><thead><tr><th>Level</th><th>Grade</th><th>Score range</th><th>Descriptor</th><th>Comment</th><th></th></tr></thead><tbody>${data.map(g=>`<tr><td>${esc(levelLabel(g.level))}</td><td><span class="badge orange">${esc(g.grade_code)}</span></td><td>${fmt(g.min_score)} – ${fmt(g.max_score)}</td><td>${fmt(g.descriptor)}</td><td>${fmt(g.comment)}</td><td><div class="actions"><button class="icon-btn" aria-label="Edit grade ${esc(g.grade_code)}" data-action="edit-grade" data-id="${esc(g.id)}">${icon("fa-pen")}</button><button class="icon-btn delete" aria-label="Delete grade ${esc(g.grade_code)}" data-action="delete-grade" data-id="${esc(g.id)}">${icon("fa-trash")}</button></div></td></tr>`).join("")}</tbody></table></div>`:empty("No grading scale configured","Add your own grades or seed a starting scale for a level.",actions)}</section>`}
  function teachersPage(){const data=state.data.teachers;return `${heading("Teachers","Manage teaching staff and their class assignments.",button("Add teacher","add-teacher","fa-user-plus"))}${state.data.teachersError?errorBox(state.data.teachersError,"teachers"):""}<section class="card section-card"><div class="section-title"><div><h2>Teaching staff</h2><p>Assignments connect teachers to a class and subject.</p></div></div>${data===null||data===undefined?loading():data.length?`<div class="table-wrap"><table><thead><tr><th>Teacher</th><th>Contact</th><th>Type</th><th>Assignments</th><th>Account</th></tr></thead><tbody>${data.map(t=>`<tr><td class="row-primary">${esc(t.name)}</td><td>${fmt(t.email)}<div class="row-sub">${fmt(t.phone)}</div></td><td><span class="badge">${fmt(t.teacher_type||"Teacher")}</span></td><td>${(t.assignments||[]).length? (t.assignments||[]).map(a=>`<div class="row-sub">${esc(a.class_name)} · ${esc(a.subject_name)} <button class="text-button" aria-label="Remove assignment" data-action="remove-assignment" data-id="${esc(t.id)}" data-assignment="${esc(a.id)}">${icon("fa-xmark")}</button></div>`).join(""):"No assignments"}<button class="text-button" data-action="assign-teacher" data-id="${esc(t.id)}">+ Assign</button></td><td><div class="actions"><button class="icon-btn" aria-label="Edit ${esc(t.name)}" data-action="edit-teacher" data-id="${esc(t.id)}">${icon("fa-pen")}</button><button class="btn btn-quiet btn-small" data-action="reset-teacher-password" data-id="${esc(t.id)}">Reset password</button></div></td></tr>`).join("")}</tbody></table></div>`:empty("No teachers added","Add a staff member, then assign their classes and subjects.",button("Add teacher","add-teacher","fa-user-plus"))}</section>`}
  function marksPage(){
    const marks=state.data.marks,classes=state.data.classes||[],subjects=state.data.subjects||[];
    const selectedClass=classes.find(c=>String(c.id)===String(state.filter.class_id));
    const level=selectedClass?.level,options=subjects.filter(s=>!level||s.level===level);
    const canLoad=!!state.filter.class_id&&!!state.filter.subject_id;
    const legacy=marks?.some(m=>(m.ca1_score!=null||m.ca2_score!=null||m.exam_score!=null)&&m.a1==null&&m.a2==null&&m.a3==null&&m.eot==null);
    const extraHead=level==="A_LEVEL"?"<th>Paper</th>":"";
    return `${heading("Marks","Enter Uganda CBC assessment scores.",`<button class="btn btn-quiet" data-action="save-marks" ${!canLoad||!marks?.length||state.data.savingMarks?"disabled":""}>${icon("fa-floppy-disk")} ${state.data.savingMarks?"Saving…":"Save marks"}</button>`)}
      <section class="card section-card"><div class="period-bar">
        <div class="field"><label for="marks-class">Class</label><select id="marks-class" data-filter="class_id">${classOptions(state.filter.class_id)}</select></div>
        <div class="field"><label for="marks-subject">Subject</label><select id="marks-subject" data-filter="subject_id"><option value="">Choose a subject</option>${options.map(s=>`<option value="${esc(s.id)}" ${String(s.id)===String(state.filter.subject_id)?"selected":""}>${esc(s.name)}</option>`).join("")}</select></div>
        <div class="field"><label for="marks-year">Academic year</label><input id="marks-year" type="number" min="2000" max="2100" value="${esc(state.filter.academic_year)}" data-filter="academic_year"></div>
        <div class="field"><label for="marks-term">Term</label><select id="marks-term" data-filter="term">${["TERM_1","TERM_2","TERM_3"].map(t=>`<option value="${t}" ${state.filter.term===t?"selected":""}>${t.replace("_"," ")}</option>`).join("")}</select></div>
        <button class="btn btn-primary" data-action="load-marks">${icon("fa-arrow-right")} Load register</button>
      </div></section>${state.data.marksError?errorBox(state.data.marksError,"marks"):""}
      <section class="card section-card"><div class="section-title"><div><h2>Assessment register</h2><p>A1–A3 are rated out of 3; EOT is out of 100.</p></div></div>
      ${!canLoad?empty("Choose a class and subject","Select the assessment period and load the register."):marks===null||marks===undefined?loading():marks.length?`${legacy?'<div class="formula-note" style="margin-bottom:15px">Older RC-2 CA1/CA2/exam marks are preserved separately. New CBC entries do not overwrite them.</div>':""}
        <div class="formula-note" style="margin-bottom:15px">AVG = (A1 + A2 + A3) ÷ 3. 20% = (AVG ÷ 3) × 20; 80% = (EOT ÷ 100) × 80; final = 20% + 80%.</div>
        <div class="table-wrap"><table id="marks-table"><thead><tr><th>Learner</th><th>A1</th><th>A2</th><th>A3</th><th>AVG</th><th>20%</th><th>EOT</th><th>80%</th><th>100%</th><th>Identifier</th>${extraHead}<th>Teacher initials</th><th>Grade</th></tr></thead><tbody>
        ${marks.map(m=>`<tr data-learner="${esc(m.learner_id)}"><td><div class="row-primary">${esc(m.full_name)}</div><div class="row-sub">${esc(m.reg_no)}</div></td>${[["a1","A1",3],["a2","A2",3],["a3","A3",3],["eot","EOT",100]].map(([key,label,max])=>`<td><label class="sr-only">${esc(m.full_name)} ${label}</label><input class="mark-input" type="number" min="0" max="${max}" step="0.01" value="${m[key]??""}" data-score="${key}" aria-label="${esc(m.full_name)} ${label}"></td>`).join("")}<td data-result="avg">${fmt(m.avg)}</td><td data-result="pct20">${fmt(m.pct20)}</td><td data-result="pct80">${fmt(m.pct80)}</td><td class="mark-total" data-result="pct100">${fmt(m.pct100)}</td><td data-result="identifier">${fmt(m.identifier)}</td>${level==="A_LEVEL"?`<td><label class="sr-only">${esc(m.full_name)} paper number</label><input class="mark-input" type="number" min="1" max="20" step="1" value="${m.paper_number??""}" data-score="paper_number" aria-label="${esc(m.full_name)} paper number"></td>`:""}<td><label class="sr-only">${esc(m.full_name)} teacher initials</label><input class="mark-input" type="text" maxlength="30" value="${esc(m.teacher_initials||"")}" data-initials aria-label="${esc(m.full_name)} teacher initials"></td><td data-result="grade"><span class="badge">${fmt(m.grade_code)}</span></td></tr>`).join("")}
        </tbody></table></div>`:empty("No learners in this class","Add active learners to the selected class before entering marks.")}</section>`;
  }
  function reportsPage(){
     const classes=state.data.classes||[],reports=reportState.data?.learners||[],learners=reportState.learners||reports.map(r=>r.learner);
    const selected=reports.find(r=>String(r.learner.id)===String(reportState.learnerId));
    const preview=selected&&window.ReportCardPreview?window.ReportCardPreview.render({...selected,school:reportState.data.school,class:reportState.data.class,term:reportState.data.term,year:reportState.data.year,term_dates:reportState.data.term_dates}):"";
    const actions=`<button class="btn btn-outline" data-action="download-class-zip" ${!reports.length||reportState.busy?"disabled":""}>${icon("fa-file-zipper")} Download class ZIP</button><button class="btn btn-primary" data-action="download-report-pdf" ${!selected||reportState.busy?"disabled":""}>${icon("fa-file-pdf")} Download PDF</button>`;
    const canManageProjects=state.role==="school_admin";
    const projects=selected?.projects||[];
    const projectPanel=selected&&isALevel(reportState.data?.class?.level)&&canManageProjects?`
      <section class="card section-card"><div class="section-title"><div><h2>A-Level projects</h2><p>Project scores are graded automatically and appear on report cards.</p></div><button class="btn btn-primary" data-action="add-project">${icon("fa-plus")} Add project</button></div>
      ${projects.length?`<div class="table-wrap"><table><thead><tr><th>Project</th><th>Score</th><th>Out of</th><th>Grade</th><th>Remarks</th><th>Teacher initials</th><th></th></tr></thead><tbody>${projects.map(project=>`<tr><td class="row-primary">${esc(project.project_name)}</td><td>${fmt(project.score)}</td><td>${fmt(project.out_of)}</td><td>${fmt(project.grade)}</td><td>${fmt(project.remarks)}</td><td>${fmt(project.teacher_initials)}</td><td><div class="actions"><button class="icon-btn" aria-label="Edit ${esc(project.project_name)}" data-action="edit-project" data-id="${esc(project.id)}">${icon("fa-pen")}</button><button class="icon-btn delete" aria-label="Delete ${esc(project.project_name)}" data-action="delete-project" data-id="${esc(project.id)}">${icon("fa-trash")}</button></div></td></tr>`).join("")}</tbody></table></div>`:empty("No projects recorded","Add this learner's first project for the selected term.",button("Add project","add-project"))}</section>`:"";
    return `${heading("Report cards","Preview and download CBC report cards for a learner or the whole class.",actions)}
      <section class="card section-card"><div class="rc-tabs"><span class="rc-tab active">${icon("fa-eye")} Preview</span></div>
      <div class="period-bar report-filters"><div class="field"><label for="report-class">Class</label><select id="report-class" data-report-filter="classId">${classOptions(reportState.classId)}</select></div>
       <div class="field"><label for="report-learner">Learner</label><select id="report-learner" data-report-filter="learnerId" ${!learners.length?"disabled":""}><option value="">Choose a learner</option>${learners.map(learner=>`<option value="${esc(learner.id)}" ${String(learner.id)===String(reportState.learnerId)?"selected":""}>${esc(learner.full_name)} · ${esc(learner.reg_no||"")}</option>`).join("")}</select></div>
      <div class="field"><label for="report-year">Year</label><input id="report-year" type="number" min="2000" max="2100" value="${esc(reportState.year)}" data-report-filter="year"></div>
      <div class="field"><label for="report-term">Term</label><select id="report-term" data-report-filter="term">${["TERM_1","TERM_2","TERM_3"].map(t=>`<option value="${t}" ${reportState.term===t?"selected":""}>${t.replace("_"," ")}</option>`).join("")}</select></div>
      <button class="btn btn-primary" data-action="load-report-class" ${reportState.busy||!classes.length?"disabled":""}>${icon("fa-eye")} Load preview</button></div>
       ${reportState.error?`<div class="alert error" role="alert">${esc(reportState.error)}</div>`:""}${reportState.busy?loading():""}
       ${!classes.length?empty("No classes yet","Create a class and add learners before generating report cards."):!reportState.data?`<div class="report-empty"><strong>Choose a class and assessment period.</strong><span>The preview uses saved marks, fees, school details, and term dates for that period.</span></div>`:!learners.length?empty("No active learners in this class","Add an active learner to this class before generating report cards."):!reportState.learnerId?empty("Choose a learner","Select a learner to preview their report card."):!selected?empty("Report data unavailable","This learner is in the class register, but report-card details were not returned. Reload the preview."):preview}</section>${projectPanel}`;
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

  function settingsPage(){
    const school=state.data.schoolSettings;
    if(!school)return `${heading("School settings","Set the current school term and the information shown on report cards.")}${state.data.settingsError?errorBox(state.data.settingsError,"settings"):`${loading()}`}`;
    return `${heading("School settings","Set the current school term and the information shown on report cards.")}${state.data.settingsError?errorBox(state.data.settingsError,"settings"):""}
      <section class="card section-card"><div class="section-title"><div><h2>Term dates and next-term fees</h2><p>These details are included on report-card previews and PDFs.</p></div></div>
      <form id="settings-form" class="form-grid" novalidate><div class="form-two">
        <div class="field"><label for="settings-current-term">Current term *</label><select id="settings-current-term" name="current_term" required>${["TERM_1","TERM_2","TERM_3"].map(t=>`<option value="${t}" ${school.current_term===t?"selected":""}>${t.replace("_"," ")}</option>`).join("")}</select></div>
        <div class="field"><label for="settings-current-year">Current year *</label><input id="settings-current-year" name="current_year" type="number" min="1900" max="2100" step="1" required value="${esc(school.current_year??new Date().getFullYear())}"></div>
        <div class="field"><label for="settings-term-ended">Term end date</label><input id="settings-term-ended" name="term_ended_on" type="date" value="${esc(String(school.term_ended_on||"").slice(0,10))}"></div>
        <div class="field"><label for="settings-next-term">Next term start date</label><input id="settings-next-term" name="next_term_begins" type="date" value="${esc(String(school.next_term_begins||"").slice(0,10))}"></div>
        <div class="field"><label for="settings-next-fees">Next-term fees</label><input id="settings-next-fees" name="next_term_fees" type="number" min="0" max="1000000000" step="0.01" value="${esc(school.next_term_fees??"")}" placeholder="e.g. 250000"></div>
      </div><div id="settings-error"></div><div class="page-actions"><button class="btn btn-primary" type="submit" ${state.data.savingSettings?"disabled":""}>${icon("fa-floppy-disk")}${state.data.savingSettings?"Saving…":"Save school settings"}</button></div></form></section>`;
  }
  function currentView(){if(state.route==="dashboard")return dashboard();if(state.route==="classes")return classesPage();if(state.route==="learners")return learnersPage();if(state.route==="subjects")return subjectsPage();if(state.route==="grading")return gradingPage();if(state.route==="teachers")return teachersPage();if(state.route==="marks")return state.role==="teacher"?teacherMarksPage():marksPage();if(state.route==="review"&&state.role==="school_admin")return reviewPage();if(state.route==="projects")return projectsPage();if(state.route==="finance")return window.ReportCardsFinance?window.ReportCardsFinance.render(state):errorBox("Finance interface did not load.");if(state.route==="settings")return settingsPage();if(state.route==="reports")return reportsPage();return dashboard()}
  function renderPasswordChange(){root.innerHTML=`<main class="auth-shell"><section class="auth-card" aria-labelledby="password-title"><div class="brand"><span class="brand-mark"></span>appshule</div><h1 id="password-title">Set a new password</h1><p class="lede">Your administrator gave you a temporary password. Choose a new password of at least 8 characters before continuing.</p><div id="modal-error"></div><form id="modal-form" class="form-grid" data-type="change-password" data-method="POST" data-endpoint="/api/auth/change-password" novalidate><div class="field"><label for="old_password">Temporary password</label><input id="old_password" name="old_password" type="password" autocomplete="current-password" required maxlength="200"></div><div class="field"><label for="new_password">New password</label><input id="new_password" name="new_password" type="password" autocomplete="new-password" minlength="8" required maxlength="200"></div><div class="field"><label for="confirm_password">Confirm new password</label><input id="confirm_password" name="confirm_password" type="password" autocomplete="new-password" minlength="8" required maxlength="200"></div><button class="btn btn-primary btn-block" type="submit">Change password ${icon("fa-arrow-right")}</button><button class="text-button" type="button" data-action="logout">Sign out</button></form></section></main>`}
  function render(){if(!state.token){renderAuth();return}if(state.mustChangePassword){renderPasswordChange();return}root.innerHTML=shell(currentView());}
  function renderAuth(){const signup=state.authMode==="signup",staff=state.authMode==="staff";const headingText=signup?"Set up your school":staff?"Staff sign in":"Welcome back";root.innerHTML=`<main class="auth-shell"><section class="auth-card" aria-labelledby="auth-title"><div class="brand"><span class="brand-mark"></span>appshule</div><h1 id="auth-title">${headingText}</h1><p class="lede">${signup?"Create your school office workspace.":staff?"Sign in to your assigned teaching or school staff workspace.":"Sign in to manage your school with confidence."}</p><div id="auth-error"></div><form id="auth-form" class="form-grid" novalidate>${signup?`<div class="field"><label for="school_name">School name</label><input id="school_name" name="school_name" required autocomplete="organization" maxlength="200"></div>`:""}<div class="field"><label for="email">${staff?"Staff email":"School email"}</label><input id="email" name="email" type="email" required autocomplete="email" maxlength="254"></div>${staff?`<div class="field"><label for="school_short_code">School code <span class="field-hint">(optional)</span></label><input id="school_short_code" name="school_short_code" maxlength="20" autocomplete="organization-title"></div>`:""}${signup?`<div class="field"><label for="phone">School phone</label><input id="phone" name="phone" type="tel" required autocomplete="tel" maxlength="60"></div>`:""}<div class="field"><label for="password">Password</label><input id="password" name="password" type="password" required autocomplete="${signup?"new-password":"current-password"}" minlength="${signup?8:1}" maxlength="200">${signup?'<span class="field-hint">Use at least 8 characters.</span>':""}</div>${signup?`<div class="field"><label for="head_teacher_name">Head teacher name <span class="field-hint">(optional)</span></label><input id="head_teacher_name" name="head_teacher_name" autocomplete="name" maxlength="200"></div><div class="form-two"><div class="field"><label for="city">City <span class="field-hint">(optional)</span></label><input id="city" name="city" maxlength="120"></div><div class="field"><label for="district">District <span class="field-hint">(optional)</span></label><input id="district" name="district" maxlength="120"></div></div>`:""}<button class="btn btn-primary btn-block" type="submit" ${state.loading?"disabled":""}>${state.loading?"Please wait…":signup?"Create school account":"Sign in"} ${icon(signup?"fa-arrow-right":"fa-arrow-right-to-bracket")}</button></form><p class="auth-footer">${signup?"Already have an account?":staff?"School administrator?":"New to AppShule?"} <button class="text-button" data-action="${signup?"toggle-auth":staff?"school-login":"toggle-auth"}">${signup?"Sign in":staff?"School login":"Create school account"}</button>${!signup&&!staff?`<br><button class="text-button" data-action="staff-login">School staff sign in</button>`:""}</p></section></main>`}
   function modalMarkup(){const m=state.modal;if(!m)return"";if(m.type==="learner-profile"){if(m.loading)return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">Learner profile</h2><p>Loading learner details…</p></div><button class="close-btn" data-action="close-modal" aria-label="Close">${icon("fa-xmark")}</button></div>${loading()}</section></div>`;if(m.error)return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">Learner profile</h2><p>Could not load learner details.</p></div><button class="close-btn" data-action="close-modal" aria-label="Close">${icon("fa-xmark")}</button></div><div class="alert error" role="alert">${esc(m.error)}</div><div class="modal-actions"><button class="btn btn-outline" data-action="close-modal">Close</button></div></section></div>`;const learner=m.learner||{},schoolClass=(state.data.classes||[]).find(c=>String(c.id)===String(learner.class_id));const fields=[["Registration number",learner.reg_no],["LIN",learner.lin],["Class",schoolClass?`${schoolClass.name}${schoolClass.stream?` · ${schoolClass.stream}`:""}`:"—"],["Gender",learner.gender],["Age",learner.age],["Section",learner.section],["House",learner.house],["Combination",learner.combination],["Parent / guardian",learner.parent_name],["Parent phone",learner.parent_phone],["Parent email",learner.parent_email],["Created",learner.created_at?new Date(learner.created_at).toLocaleDateString("en-UG"):"—"]];return `<div class="modal-backdrop" data-action="backdrop"><section class="modal learner-profile-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">${esc(learner.full_name||"Learner profile")}</h2><p>Learner details and guardian contact</p></div><button class="close-btn" data-action="close-modal" aria-label="Close">${icon("fa-xmark")}</button></div>${learner.photo_base64?`<img class="learner-profile-photo" src="${esc(learner.photo_base64)}" alt="${esc(learner.full_name||"Learner")}">`:""}<dl class="learner-profile-grid">${fields.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${fmt(value)}</dd></div>`).join("")}</dl><div class="modal-actions"><button class="btn btn-outline" data-action="close-modal">Close</button><button class="btn btn-primary" data-action="edit-profile-learner" data-id="${esc(learner.id)}">${icon("fa-pen")} Edit learner</button></div></section></div>`}if(m.type==="review-entry")return `<div class="modal-backdrop" data-action="backdrop"><section class="modal review-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">Review ${esc(m.submission.class_name||"class")} · ${esc(m.submission.subject_name||"subject")}</h2><p>${esc(m.period.term)} · ${esc(m.period.year)} — edit scores if needed, then save.</p></div><button class="close-btn" data-action="close-modal" aria-label="Close">${icon("fa-xmark")}</button></div><div class="table-wrap"><table id="review-edit-table"><thead><tr><th>Learner</th><th>A1</th><th>A2</th><th>A3</th><th>EOT</th></tr></thead><tbody>${m.learners.map(l=>`<tr data-learner="${esc(l.learner_id)}"><td>${esc(l.full_name)}</td>${["a1","a2","a3","eot"].map(k=>`<td><input class="mark-input" type="number" min="0" max="${k==="eot"?100:3}" step=".01" data-review-score="${k}" value="${l[k]??""}" aria-label="${esc(l.full_name)} ${k}"></td>`).join("")}</tr>`).join("")}</tbody></table></div><div class="modal-actions"><button class="btn btn-outline" data-action="close-modal">Close</button><button class="btn btn-primary" data-action="save-review-edit">${icon("fa-floppy-disk")} Save edits</button></div></section></div>`;if(m.type==="password-success")return `<div class="modal-backdrop" data-action="backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">Temporary password ready</h2><p>Share this temporary credential securely with the teacher.</p></div><button class="close-btn" data-action="close-modal" aria-label="Close">${icon("fa-xmark")}</button></div><div class="password-reveal"><label>Temporary password — shown once</label><div class="copy-line"><code id="temp-password">${esc(m.password)}</code><button class="btn btn-primary" data-action="copy-password">${icon("fa-copy")} Copy</button></div><p class="password-warning">This password is not saved in the app. The teacher should change it after signing in.</p></div><div class="modal-actions"><button class="btn btn-primary" data-action="close-modal">Done</button></div></section></div>`;
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
    if(m.type==="learner"){title=editing?"Edit learner":"Register a learner";endpoint=editing?`/api/learners/${encodeURIComponent(item.id)}`:"/api/learners";body=`<div class="form-two"><div class="field wide"><label for="f-class_id">Class *</label><select name="class_id" id="f-class_id" required>${classOptions(item.class_id,false)}</select></div><div class="field"><label for="f-reg_no">Registration number *</label><input id="f-reg_no" name="reg_no" required maxlength="120" value="${esc(item.reg_no||"")}"></div><div class="field"><label for="f-full_name">Full name *</label><input id="f-full_name" name="full_name" required maxlength="200" value="${esc(item.full_name||"")}"></div><div class="field"><label for="f-gender">Gender</label><select id="f-gender" name="gender"><option value="">Not specified</option>${["Female","Male","Other"].map(v=>`<option ${item.gender===v?"selected":""}>${v}</option>`).join("")}</select></div><div class="field"><label for="f-age">Age</label><input id="f-age" name="age" type="number" min="0" max="120" value="${esc(item.age??"")}"></div><div class="field"><label for="f-parent_name">Parent / guardian</label><input id="f-parent_name" name="parent_name" maxlength="200" value="${esc(item.parent_name||"")}"></div><div class="field"><label for="f-parent_phone">Parent phone</label><input id="f-parent_phone" name="parent_phone" type="tel" maxlength="60" value="${esc(item.parent_phone||"")}"></div><div class="field wide"><label for="f-parent_email">Parent email</label><input id="f-parent_email" name="parent_email" type="email" maxlength="254" value="${esc(item.parent_email||"")}"></div></div>`}
    if(m.type==="subject"){title=editing?"Edit subject":"Add a subject";endpoint=editing?`/api/subjects/${encodeURIComponent(item.id)}`:"/api/subjects";body=`<div class="form-two"><div class="field wide"><label for="f-name">Subject name *</label><input id="f-name" name="name" required maxlength="160" value="${esc(item.name||"")}"></div><div class="field"><label for="f-level">Level *</label><select id="f-level" name="level" required>${levelOptions(item.level)}</select></div><div class="field"><label for="f-code">Subject code</label><input id="f-code" name="code" maxlength="40" value="${esc(item.code||"")}"></div><div class="field"><label for="f-papers">Papers</label><input id="f-papers" name="papers" type="number" min="1" max="10" value="${esc(item.papers||1)}"></div></div>`}
    if(m.type==="grade"){title=editing?"Edit grade":"Add a grade";endpoint=editing?`/api/grading/${encodeURIComponent(item.id)}`:"/api/grading";body=`<div class="form-two"><div class="field"><label for="f-level">Level *</label><select id="f-level" name="level" required>${levelOptions(item.level)}</select></div><div class="field"><label for="f-grade_code">Grade code *</label><input id="f-grade_code" name="grade_code" required maxlength="30" value="${esc(item.grade_code||"")}"></div><div class="field"><label for="f-min_score">Minimum score *</label><input id="f-min_score" name="min_score" type="number" min="0" max="100" step=".01" required value="${esc(item.min_score??"")}"></div><div class="field"><label for="f-max_score">Maximum score *</label><input id="f-max_score" name="max_score" type="number" min="0" max="100" step=".01" required value="${esc(item.max_score??"")}"></div><div class="field wide"><label for="f-descriptor">Descriptor</label><input id="f-descriptor" name="descriptor" maxlength="200" value="${esc(item.descriptor||"")}"></div><div class="field wide"><label for="f-comment">Comment</label><textarea id="f-comment" name="comment" maxlength="1000">${esc(item.comment||"")}</textarea></div></div>`}
     if(m.type==="teacher"){title=editing?"Edit teacher":"Add a teacher";endpoint=editing?`/api/teachers/${encodeURIComponent(item.id)}`:"/api/teachers";body=`<div class="form-two"><div class="field wide"><label for="f-name">Teacher name *</label><input id="f-name" name="name" required maxlength="200" value="${esc(item.name||"")}"></div><div class="field"><label for="f-email">Email *</label><input id="f-email" name="email" type="email" required maxlength="254" value="${esc(item.email||"")}"></div><div class="field"><label for="f-phone">Phone</label><input id="f-phone" name="phone" type="tel" maxlength="60" value="${esc(item.phone||"")}"></div><div class="field wide"><label for="f-teacher_type">Teacher type</label><select id="f-teacher_type" name="teacher_type"><option value="regular" ${!item.teacher_type||item.teacher_type==="regular"?"selected":""}>Regular teacher</option><option value="class_teacher" ${item.teacher_type==="class_teacher"?"selected":""}>Class teacher</option></select></div></div>`}
    if(m.type==="assignment"){title="Assign teacher";endpoint="";body=`<input type="hidden" name="teacher_id" value="${esc(m.teacherId)}"><div class="form-grid"><div class="field"><label for="f-class_id">Class *</label><select id="f-class_id" name="class_id" required>${classOptions("",false)}</select></div><div class="field"><label for="f-subject_id">Subject *</label><select id="f-subject_id" name="subject_id" required><option value="">Choose a subject</option>${(state.data.subjects||[]).map(s=>`<option value="${esc(s.id)}">${esc(s.name)} · ${esc(levelLabel(s.level))}</option>`).join("")}</select></div></div>`}
    return `<div class="modal-backdrop" data-action="backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">${title}</h2><p>Fields marked * are required.</p></div><button class="close-btn" data-action="close-modal" aria-label="Close">${icon("fa-xmark")}</button></div><div id="modal-error"></div><form id="modal-form" data-type="${m.type}" data-endpoint="${esc(endpoint)}" data-method="${method}" novalidate>${body}<div class="modal-actions"><button class="btn btn-outline" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">${editing?"Save changes":m.type==="assignment"?"Assign":"Save"}</button></div></form></section></div>`;
  }
  function formValues(form){
    const fd=new FormData(form), out={};
    for(const [key,raw] of fd.entries()){
      const value=String(raw).trim();
      if(["age","papers","min_score","max_score","score","out_of","year"].includes(key))out[key]=value===""?null:Number(value);
      else out[key]=value;
    }
    return out;
  }
  async function handleModalSubmit(form){
    const values=formValues(form), type=form.dataset.type, method=form.dataset.method;
    if(!form.reportValidity())return;
    if(type==="grade"&&values.min_score>values.max_score){document.getElementById("modal-error").innerHTML='<div class="alert error">Minimum score cannot exceed maximum score.</div>';return}
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
       if(type==="learner")state.modal=null;
       toast(method==="PATCH"?"Changes saved.":"Record added.");await loadRoute(state.route);
    }catch(error){const err=document.getElementById("modal-error");if(err)err.innerHTML=`<div class="alert error" role="alert">${esc(error.message)}</div>`;submit.disabled=false;submit.textContent=method==="PATCH"?"Save changes":type==="assignment"?"Assign":"Save"}
  }
  function parseCsv(text){
    const rows=[];let row=[],field="",quoted=false;
    for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++}else if(c==='"')quoted=false;else field+=c}else if(c==='"'){quoted=true}else if(c===","){row.push(field);field=""}else if(c==="\n"||c==="\r"){if(c==="\r"&&text[i+1]==="\n")i++;row.push(field);if(row.some(v=>v.trim()!==""))rows.push(row);row=[];field=""}else field+=c}
    if(quoted)throw new Error("CSV has an unclosed quoted field.");row.push(field);if(row.some(v=>v.trim()!==""))rows.push(row);if(rows.length<2)throw new Error("CSV must include a header row and at least one learner.");
    const headers=rows.shift().map(h=>h.replace(/^\uFEFF/,"").trim().toLowerCase());if(!headers.includes("reg_no")||!headers.includes("full_name"))throw new Error("CSV requires reg_no and full_name columns.");
    const allowed=["reg_no","full_name","gender","age","parent_name","parent_phone","parent_email"];
    const errors=[];const parsed=rows.map((cells,i)=>{const obj={};headers.forEach((h,index)=>{if(allowed.includes(h))obj[h]=(cells[index]||"").trim()});if(!obj.reg_no||!obj.full_name){errors.push({row:i+2,error:"reg_no and full_name are required"});return null}if(obj.age)obj.age=Number(obj.age);else delete obj.age;return {sourceRow:i+2,data:obj}}).filter(Boolean);
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
    try{await api(path+encodeURIComponent(id),{method:"DELETE"});toast(`${label[0].toUpperCase()+label.slice(1)} deleted.`);await loadRoute(state.route)}catch(e){toast(e.message,"error")}
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
  async function action(button,clickEvent){
    const a=button.dataset.action,id=button.dataset.id;
    if(a==="toggle-auth"){state.authMode=state.authMode==="signup"?"login":"signup";renderAuth();return}
    if(a==="staff-login"){state.authMode="staff";renderAuth();return}
    if(a==="school-login"){state.authMode="login";renderAuth();return}
    if(a==="logout"){logout();return}
    if(a==="menu"){document.querySelector(".sidebar")?.classList.add("open");if(!document.querySelector(".sidebar-scrim")){const s=document.createElement("div");s.className="sidebar-scrim";s.addEventListener("click",()=>{document.querySelector(".sidebar").classList.remove("open");s.remove()});root.append(s)}return}
    if(a==="close-modal"){state.modal=null;render();return}
    if(a==="backdrop"&&button===clickEvent.target){state.modal=null;render();return}
    if(a==="copy-password"){try{await navigator.clipboard.writeText(state.modal?.password||"");toast("Temporary password copied.")}catch{toast("Clipboard access is unavailable. Select and copy the password manually.","error")}return}
    if(["add-class","add-learner","add-subject","add-grade","add-teacher"].includes(a)){const map={"add-class":"class","add-learner":"learner","add-subject":"subject","add-grade":"grade","add-teacher":"teacher"};state.modal={type:map[a]};render();setTimeout(()=>document.querySelector(".modal input, .modal select")?.focus(),30);return}
     if(a==="view-learner"){await openLearnerProfile(id);return}
     if(a==="edit-learner"||a==="edit-profile-learner"){await editLearner(id);return}
     if(["edit-class","edit-subject","edit-grade"].includes(a)){const type=a.split("-")[1];state.modal={type,item:rowFrom(type,id)};render();return}
    if(a==="add-project"){const learnerId=state.route==="projects"?"":reportState.learnerId;if(state.route==="projects"&&!(state.data.projectRegister?.learners||[]).length){toast("Load a class with active learners before adding a project.","error");return}if(state.route!=="projects"&&!learnerId)return;state.modal={type:"project",learnerId};render();setTimeout(()=>document.querySelector("#f-project_name")?.focus(),30);return}
    if(a==="edit-project"){const selected=reportState.data?.learners?.find(r=>String(r.learner.id)===String(reportState.learnerId));const item=(state.data.projectRegister?.projects||[]).find(project=>String(project.id)===String(id))||selected?.projects?.find(project=>String(project.id)===String(id));if(!item)return;state.modal={type:"project",item,learnerId:item.learner_id||reportState.learnerId};render();return}
    if(a==="delete-project"){await deleteProject(id);return}
    if(a.startsWith("delete-")){await deleteRecord(a.slice(7),id);return}
    if(a==="assign-teacher"){state.modal={type:"assignment",teacherId:id};render();return}
    if(a==="edit-teacher"){const item=(state.data.teachers||[]).find(x=>String(x.id)===String(id));if(item){state.modal={type:"teacher",item};render()}return}
    if(a==="reset-teacher-password"){if(!confirm("Reset this teacher’s password? A temporary password will be shown once."))return;try{const r=await api(`/api/teachers/${encodeURIComponent(id)}/reset-password`,{method:"POST",body:{}});state.modal={type:"password-success",password:String(r.initial_password||"")};render()}catch(e){toast(e.message,"error")}return}
    if(a==="remove-assignment"){if(!confirm("Remove this teacher assignment?"))return;try{await api(`/api/rm/assignments/${encodeURIComponent(button.dataset.assignment)}`,{method:"DELETE"});toast("Assignment removed.");await loadRoute("teachers")}catch(e){toast(e.message,"error")}return}
    if(a==="apply-learners"){const search=document.getElementById("learner-search");if(search)state.filter.search=search.value.trim();await loadRoute("learners");return}
    if(a==="import-csv"){document.getElementById("csv-file")?.click();return}
    if(a==="apply-level-subjects"||a==="apply-level-grading"){const select=document.querySelector(`[data-filter="level"]`);state.filter.level=select?.value||"";await loadRoute(state.route);return}
    if(a==="seed-subjects"||a==="seed-grading"){const level=state.filter.level||prompt("Choose level: NURSERY, PRIMARY, O_LEVEL, or A_LEVEL","PRIMARY");if(!level)return;const normalized=level.toUpperCase();if(!LEVELS.some(x=>x[0]===normalized)){toast("Enter a valid school level.","error");return}try{const r=await api(a==="seed-subjects"?"/api/subjects/seed-defaults":"/api/grading/seed-defaults",{method:"POST",body:{level:normalized}});toast(`${r.inserted||0} defaults added for ${levelLabel(normalized)}.`);state.filter.level=normalized;await loadRoute(state.route)}catch(e){toast(e.message,"error")}return}
    if(a==="dashboard"||a==="classes"||a==="learners"||a==="subjects"||a==="grading"||a==="teachers"||a==="marks"||a==="projects"||a==="settings"){await loadRoute(a);return}
    if(a==="load-marks"){await loadMarks();return}
    if(a==="open-assigned"){state.filter.class_id=button.dataset.class;state.filter.subject_id=button.dataset.subject;state.route="marks";location.hash="marks";render();await loadTeacherMarks();return}
    if(a==="load-teacher-marks"){await loadTeacherMarks();return}
    if(a==="save-teacher-marks"){await saveTeacherMarks();return}
    if(a==="submit-marks-review"){try{if(!await saveTeacherMarks(false))return;await api(`/api/rm/class/${encodeURIComponent(state.filter.class_id)}/submit-for-review`,{method:"POST",body:{subject_id:state.filter.subject_id,term:state.filter.term,year:Number(state.filter.academic_year)}});toast("Marks submitted for review.");await loadTeacherMarks()}catch(e){toast(e.message,"error")}return}
    if(a==="save-comment"){await saveTeacherComment(button.dataset.learner);return}
    if(a==="save-signature"){await persistSignature();return}
    if(a==="clear-signature"){const c=document.getElementById("signature-canvas");c?.getContext("2d").clearRect(0,0,c.width,c.height);return}
    if(a==="load-review"){await loadReviewQueue();return}
    if(a==="view-submission"){const row=(state.rm.review||[]).find(x=>String(x.id)===String(id));if(row){try{const q=new URLSearchParams({subject_id:row.subject_id,term:row.term,year:String(row.year)});const data=await api(`/api/rm/class/${encodeURIComponent(row.class_id)}/marks?${q}`);state.modal={type:"review-entry",submission:row,learners:data.learners||[],period:{subject_id:row.subject_id,term:row.term,year:Number(row.year)}};render()}catch(e){toast(e.message,"error")}}return}
    if(a==="save-review-edit"){const m=state.modal;if(!m)return;const rows=[...document.querySelectorAll("#review-edit-table tbody tr")].map(tr=>{const out={learner_id:tr.dataset.learner};tr.querySelectorAll("[data-review-score]").forEach(i=>out[i.dataset.reviewScore]=i.value===""?null:Number(i.value));const original=m.learners.find(l=>String(l.learner_id)===String(tr.dataset.learner));return {...out,paper_number:original?.paper_number??null,teacher_initials:original?.teacher_initials??null}});try{await api(`/api/rm/class/${encodeURIComponent(m.submission.class_id)}/marks-bulk`,{method:"POST",body:{...m.period,rows}});toast("Review edits saved.");state.modal=null;await loadReviewQueue()}catch(e){toast(e.message,"error")}return}
     if(a==="approve-submission"||a==="return-submission"){const comment=a==="return-submission"?prompt("Add a note for the teacher (optional):"):"";if(comment===null)return;try{await api(`/api/rm/submissions/${encodeURIComponent(id)}/review`,{method:"POST",body:{decision:a==="approve-submission"?"approve":"return",...(comment?{comment}: {})}});toast(a==="approve-submission"?"Submission approved.":"Submission returned to teacher.");await loadReviewQueue()}catch(e){toast(e.message,"error")}return}
    if(a==="publish-submission"){if(!confirm("Publish these results to report cards?"))return;try{await api(`/api/rm/submissions/${encodeURIComponent(id)}/publish`,{method:"POST",body:{}});toast("Results published.");await loadReviewQueue()}catch(e){toast(e.message,"error")}return}
    if(a==="save-marks"){await saveMarks();return}
    if(a==="load-report-class"){await loadReportClass();return}
    if(a==="load-project-register"){await loadProjectRegister();return}
    if(a==="download-report-pdf"){await downloadReportPdf();return}
    if(a==="download-class-zip"){await downloadClassZip();return}
    if(a==="reload"){await loadRoute(state.route);return}
  }
  async function saveTeacherMarks(notify=true){
    const rows=[...document.querySelectorAll("#teacher-marks-table tbody tr[data-learner]")].map(tr=>{const values={};tr.querySelectorAll("[data-score]").forEach(i=>values[i.dataset.score]=i.value===""?null:Number(i.value));return {learner_id:tr.dataset.learner,a1:values.a1,a2:values.a2,a3:values.a3,eot:values.eot,paper_number:values.paper_number??null,teacher_initials:tr.querySelector("[data-initials]")?.value.trim()||null}});
    for(const r of rows){if(["a1","a2","a3"].some(k=>r[k]!==null&&(!Number.isFinite(r[k])||r[k]<0||r[k]>3))||r.eot!==null&&(!Number.isFinite(r.eot)||r.eot<0||r.eot>100)||r.paper_number!==null&&(!Number.isInteger(r.paper_number)||r.paper_number<1||r.paper_number>20)){toast("A1–A3 must be 0–3, EOT 0–100, and paper number a whole number from 1–20.","error");return false}}
    try{await api(`/api/rm/class/${encodeURIComponent(state.filter.class_id)}/marks-bulk`,{method:"POST",body:{subject_id:state.filter.subject_id,term:state.filter.term,year:Number(state.filter.academic_year),rows}});if(notify)toast(`Saved ${rows.length} learner records.`);return true}catch(e){toast(e.message,"error");return false}
  }
  async function saveTeacherComment(learnerId){
    const field=document.querySelector(`[data-comment="${CSS.escape(learnerId)}"]`),status=document.querySelector(`[data-comment-state="${CSS.escape(learnerId)}"]`);if(!field)return;
    const write=(text,kind="")=>{if(status){status.className=`comment-save-state ${kind}`;status.textContent=text}};
    write("Saving comment…");
    try{await api(`/api/rm/cards/${encodeURIComponent(learnerId)}/class-teacher-comment`,{method:"POST",body:{term:state.filter.term,year:Number(state.filter.academic_year),comment:field.value.trim()}});state.rm.comments[learnerId]=field.value.trim();write("Comment saved","success")}catch(e){write(`Could not save: ${e.message}`,"error")}
  }
  function canvasPoint(canvas,event){const rect=canvas.getBoundingClientRect();return {x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height}}
  let drawing=false,lastPoint=null;
  async function persistSignature(){
    const canvas=document.getElementById("signature-canvas");if(!canvas)return;
    const data_url=canvas.toDataURL("image/png");const status=document.querySelector(".signature-card .section-title");
    state.rm.signatureStatus={text:"Saving signature…",kind:"success"};if(status){const note=document.createElement("p");note.className="signature-inline-status";note.textContent="Saving signature…";status.after(note)}
    try{await api("/api/rm/teachers/signature",{method:"POST",body:{data_url}});state.rm.signature={data_url};state.rm.signatureStatus={text:"Signature saved.",kind:"success"};render()}catch(e){state.rm.signatureStatus={text:`Could not save signature: ${e.message}`,kind:"error"};render()}
  }
  async function saveMarks(){
    const rows=[...document.querySelectorAll("#marks-table tbody tr")].map(tr=>{const values={};tr.querySelectorAll("[data-score]").forEach(i=>{values[i.dataset.score]=i.value===""?null:Number(i.value)});return {learner_id:tr.dataset.learner,...values,teacher_initials:tr.querySelector("[data-initials]")?.value.trim()||null}});
    for(const row of rows){for(const key of ["a1","a2","a3"])if(row[key]!==null&&(!Number.isFinite(row[key])||row[key]<0||row[key]>3)){toast("A1, A2, and A3 must be between 0 and 3.","error");return}if(row.eot!==null&&(!Number.isFinite(row.eot)||row.eot<0||row.eot>100)){toast("EOT must be between 0 and 100.","error");return}if(row.paper_number!==undefined&&row.paper_number!==null&&(!Number.isInteger(row.paper_number)||row.paper_number<1||row.paper_number>20)){toast("Paper number must be a whole number from 1 to 20.","error");return}}
    const failures=[];state.data.savingMarks=true;render();
    for(const row of rows){try{await api(`/api/learners/${encodeURIComponent(row.learner_id)}/marks/${encodeURIComponent(state.filter.subject_id)}`,{method:"PATCH",body:{term:state.filter.term,year:Number(state.filter.academic_year),a1:row.a1,a2:row.a2,a3:row.a3,eot:row.eot,paper_number:row.paper_number,teacher_initials:row.teacher_initials}})}catch(error){failures.push(`${row.learner_id}: ${error.message}`)}}
    state.data.savingMarks=false;await loadMarks();
    if(failures.length)toast(`${rows.length-failures.length} of ${rows.length} learners saved; ${failures.length} failed. ${failures[0]}`,"error");
    else toast(`Marks saved for ${rows.length} learners.`);
  }
  function calculateMarks(tr){
    const vals={};tr.querySelectorAll("[data-score]").forEach(i=>vals[i.dataset.score]=i.value===""?null:Number(i.value));
    const avg=[vals.a1,vals.a2,vals.a3].every(v=>v!==null)?(vals.a1+vals.a2+vals.a3)/3:null;
    const pct20=avg===null?null:(avg/3)*20,pct80=vals.eot===null?null:(vals.eot/100)*80,pct100=pct20===null||pct80===null?null:pct20+pct80;
    const identifier=avg===null?null:avg>=2.5?3:avg>=1.5?2:1;
    const level=(state.data.classes||[]).find(c=>String(c.id)===String(state.filter.class_id))?.level;
    let grade=null;if(pct100!==null){if(level==="A_LEVEL")grade=pct100>=75?"A":pct100>=65?"B":pct100>=50?"C":pct100>=35?"D":"E";else grade=pct100>=80?"A":pct100>=70?"B":pct100>=60?"C":pct100>=50?"D":"E";}
    const write=(key,v)=>{const el=tr.querySelector(`[data-result="${key}"]`);if(el)el.innerHTML=v===null?"—":esc(Number(v).toFixed(2))};
    write("avg",avg);write("pct20",pct20);write("pct80",pct80);write("pct100",pct100);write("identifier",identifier);const g=tr.querySelector('[data-result="grade"]');if(g)g.innerHTML=`<span class="badge">${grade?esc(grade):"—"}</span>`;
  }
  async function loadReportClass(){
    if(!reportState.classId){reportState.error="Choose a class first.";render();return}
    if(!/^\d{4}$/.test(String(reportState.year))){reportState.error="Enter a valid four-digit year.";render();return}
    reportState.busy=true;reportState.error="";render();
    const q=new URLSearchParams({term:reportState.term,year:String(reportState.year)});
    try{const classId=reportState.classId;const learnerQuery=new URLSearchParams({class_id:classId});const [cardData,rosterData]=await Promise.all([api(`/api/class/${encodeURIComponent(classId)}/card-data?${q}`),api(`/api/learners?${learnerQuery}`)]);reportState.data=cardData;reportState.learners=rosterData.learners||[];const reports=cardData.learners||[];const mismatches=reportState.learners.filter(learner=>!reports.some(report=>String(report.learner.id)===String(learner.id)));if(mismatches.length)reportState.error="The class register and report-card data returned different learners. Reload the preview and try again.";if(!reportState.learners.some(learner=>String(learner.id)===String(reportState.learnerId)))reportState.learnerId=reportState.learners[0]?.id||""}
    catch(error){reportState.data=null;reportState.learners=[];reportState.error=error.message}
    finally{reportState.busy=false;render()}
  }
  function saveDownload(blob,name){const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
  function filePart(value){return String(value||"learner").normalize("NFKD").replace(/[^\w.-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,90)||"learner"}
  function reportForDownload(report){return {...report,school:reportState.data.school,class:reportState.data.class,term:reportState.data.term,year:reportState.data.year,term_dates:reportState.data.term_dates}}
  async function downloadReportPdf(){
    const report=reportState.data?.learners?.find(r=>String(r.learner.id)===String(reportState.learnerId));
    if(!report){toast("Load a class and choose a learner first.","error");return}
    if(!window.ReportCardPdf||!window.PDFLib){toast("The PDF library did not load. Refresh and try again.","error");return}
    try{const bytes=await window.ReportCardPdf.render(reportForDownload(report),reportState.data.class.level);saveDownload(new Blob([bytes],{type:"application/pdf"}),`${filePart(report.learner.reg_no||report.learner.full_name)}-${reportState.data.term}-${reportState.data.year}.pdf`)}
    catch(error){toast(error.message||"Could not generate the PDF.","error")}
  }
  async function downloadClassZip(){
    const reports=reportState.data?.learners||[];
    if(!reports.length){toast("Load a class first.","error");return}
    if(!window.ReportCardPdf||!window.PDFLib){toast("The PDF library did not load. Refresh and try again.","error");return}
    reportState.busy=true;render();
    try{const files=[];for(const report of reports){const bytes=await window.ReportCardPdf.render(reportForDownload(report),reportState.data.class.level);files.push({name:`${filePart(report.learner.reg_no||report.learner.full_name)}-${filePart(report.learner.full_name)}.pdf`,bytes})}const zip=window.ReportCardPdf.createZip(files);saveDownload(new Blob([zip],{type:"application/zip"}),`report-cards-${filePart(reportState.data.class.name)}-${reportState.data.term}-${reportState.data.year}.zip`);toast(`Downloaded ${reports.length} report cards.`)}
    catch(error){toast(error.message||"Could not create the class ZIP.","error")}
    finally{reportState.busy=false;render()}
  }

  async function saveSchoolSettings(form){
    if(!form.reportValidity())return;
    const fd=new FormData(form);
    const body={
      current_term:String(fd.get("current_term")||""),
      current_year:Number(fd.get("current_year")),
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
        reportState.data.school={...reportState.data.school,current_term:saved.current_term,current_year:saved.current_year};
      }
      state.data.savingSettings=false;render();toast("School term settings saved.");
    }catch(error){
      state.data.savingSettings=false;render();
      const target=document.getElementById("settings-error");
      if(target)target.innerHTML=`<div class="alert error" role="alert">${esc(error.message)}</div>`;
    }
  }
  root.addEventListener("click",e=>{const financeTab=e.target.closest("[data-fin-tab]");if(financeTab){e.preventDefault();state.finance.tab=financeTab.dataset.finTab;loadRoute("finance");return}const financeButton=e.target.closest("[data-fin-action]");if(financeButton){e.preventDefault();financeAction(financeButton);return}const link=e.target.closest("[data-route]");if(link){e.preventDefault();go(link.dataset.route);return}const btn=e.target.closest("[data-action]");if(btn)action(btn,e)});
  root.addEventListener("input",e=>{if(e.target.matches("[data-score]"))calculateMarks(e.target.closest("tr"))});
  root.addEventListener("change",e=>{const t=e.target;if(t.matches("[data-filter]")){state.filter[t.dataset.filter]=t.value;if(t.dataset.filter==="class_id"&&state.route==="marks"){state.filter.subject_id="";loadRoute("marks")}else if(t.dataset.filter==="level"&&["subjects","grading"].includes(state.route)){state.filter.level=t.value;loadRoute(state.route)}}if(t.matches("[data-rm-filter]")){state.filter[t.dataset.rmFilter]=t.value;if(t.dataset.rmFilter==="class_id"){const first=(state.rm.classes||[]).find(c=>String(c.class_id)===String(t.value));state.filter.subject_id=first?.subject_id||""}if(state.route==="review")loadReviewQueue();else render()}if(t.matches("[data-report-filter]")){reportState[t.dataset.reportFilter]=t.value;if(t.dataset.reportFilter!=="learnerId"){reportState.data=null;reportState.learners=[];reportState.learnerId="";reportState.error=""}render()}if(t.matches("[data-fin-filter]")){state.finance[t.dataset.finFilter]=t.value;if(t.dataset.finFilter==="reportClass")state.finance.reportClass=t.value;loadRoute("finance")}if(t.matches("[data-signature-file]")&&t.files?.[0]){const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{const c=document.getElementById("signature-canvas"),ctx=c.getContext("2d");ctx.clearRect(0,0,c.width,c.height);const scale=Math.min(c.width/img.width,c.height/img.height);ctx.drawImage(img,(c.width-img.width*scale)/2,(c.height-img.height*scale)/2,img.width*scale,img.height*scale)};img.src=reader.result};reader.readAsDataURL(t.files[0])}if(t.id==="csv-file"&&t.files?.[0])importCsv(t.files[0]);if(t.id==="finance-csv"&&t.files?.[0])importFinanceCsv(t.files[0])});
  root.addEventListener("change",e=>{const filter=e.target.closest("[data-project-filter]");if(!filter)return;projectState[filter.dataset.projectFilter]=filter.value;projectState.error="";state.data.projectRegister=null;render()});
  root.addEventListener("submit",async e=>{if(e.target.id==="auth-form"){e.preventDefault();await submitAuth(e.target)}else if(e.target.id==="modal-form"){e.preventDefault();await handleModalSubmit(e.target)}else if(e.target.matches("[data-fin-form]")){e.preventDefault();await handleFinanceSubmit(e.target)}else if(e.target.id==="settings-form"){e.preventDefault();await saveSchoolSettings(e.target)}});
  root.addEventListener("keydown",e=>{if(e.key==="Escape"&&state.modal){state.modal=null;render()}});
  root.addEventListener("pointerdown",e=>{const c=e.target.closest("#signature-canvas");if(!c)return;drawing=true;lastPoint=canvasPoint(c,e);c.setPointerCapture?.(e.pointerId)});
  root.addEventListener("pointermove",e=>{const c=e.target.closest("#signature-canvas");if(!c||!drawing)return;const p=canvasPoint(c,e),ctx=c.getContext("2d");ctx.lineWidth=3;ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle="#35206f";ctx.beginPath();ctx.moveTo(lastPoint.x,lastPoint.y);ctx.lineTo(p.x,p.y);ctx.stroke();lastPoint=p});
  root.addEventListener("pointerup",()=>{drawing=false;lastPoint=null});root.addEventListener("pointercancel",()=>{drawing=false;lastPoint=null});
  root.addEventListener("keydown",e=>{const c=e.target.closest("#signature-canvas");if(!c||!["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key))return;e.preventDefault();const ctx=c.getContext("2d"),x=c.width/2,y=c.height/2;ctx.lineWidth=3;ctx.lineCap="round";ctx.strokeStyle=e.shiftKey?"#ffffff":"#35206f";ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(e.key==="ArrowRight"?14:e.key==="ArrowLeft"?-14:0),y+(e.key==="ArrowDown"?14:e.key==="ArrowUp"?-14:0));ctx.stroke()});
  async function submitAuth(form){
    if(!form.reportValidity())return;state.loading=true;const mode=state.authMode;renderAuth();
    const values=Object.fromEntries(new FormData(form).entries());
    if(mode==="staff"&&typeof values.school_short_code==="string"){values.school_short_code=values.school_short_code.trim();if(!values.school_short_code)delete values.school_short_code}
    try{
      const path=mode==="signup"?"/api/auth/signup-school":mode==="staff"?"/api/auth/login-staff":"/api/auth/login-school";
      const result=await api(path,{method:"POST",auth:false,body:values});
      state.token=result.token;localStorage.setItem(TOKEN_KEY,state.token);state.authMode="login";
      if(mode==="signup"||mode==="login"){state.school=result.school;state.user=null;state.role="school_admin";state.mustChangePassword=false}
      else{
        state.user=result.user||null;state.role=result.role||result.user?.finance_role||result.user?.role||"teacher";state.mustChangePassword=result.must_change_password===true;
        const me=await api("/api/auth/me");state.user=me.user||state.user;state.school=me.school||null;state.role=me.role||state.role;state.mustChangePassword=me.must_change_password===true;
      }
      state.modal=null;
      state.route=hasFinanceAccess()?"finance":"dashboard";
      if(state.route==="finance")state.finance.tab="overview";
      state.loading=false;
      if(location.hash!==`#${state.route}`)location.hash=state.route;
      render();if(!state.mustChangePassword)await loadRoute(state.route)
    }
    catch(error){state.loading=false;state.token="";state.user=null;state.school=null;localStorage.removeItem(TOKEN_KEY);renderAuth();document.getElementById("auth-error").innerHTML=`<div class="alert error" role="alert">${esc(error.message)}</div>`}
  }
  window.addEventListener("hashchange",()=>{const route=location.hash.slice(1);if(navItems.some(x=>x[0]===route)&&state.token&&state.route!==route)go(route)});
  if(location.hash&&navItems.some(x=>x[0]===location.hash.slice(1)))state.route=location.hash.slice(1);
  render();verifySession();
})();
