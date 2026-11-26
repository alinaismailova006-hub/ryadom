import {useEffect,useState} from 'react';
import {Heart,MessagesSquare,Sparkles,ChartNoAxesCombined,Settings,X,Copy,Check,Plus,LoaderCircle,LayoutGrid,CalendarDays,CalendarHeart,CheckCircle2} from 'lucide-react';
import {packs,dates,dailyId,dailyText} from './content';
import AccountForm from './account-form';
import RelationshipPanel from './relationship-panel';
import {calendarToday,daysBetween,daysLabel,type Milestone} from './relationship';
type Answer={question:string,value:string,mine:boolean};
type Data={signedIn:boolean,me?:{name:string,pair_id?:string},pair?:{code:string,partner:string|null,createdAt:number,startDate?:string|null,photoVersion?:string|null},events?:Milestone[],answers?:Answer[],completed?:string[]};
const nav=[['home','Наше место',LayoutGrid],['questions','Вопросы и тесты',MessagesSquare],['dates','Маленькие свидания',CalendarDays],['results','Наши открытия',ChartNoAxesCombined],['memories','Памятные даты',CalendarHeart]] as const;
export default function Home(){
 const [data,setData]=useState<Data>({signedIn:false}),[loading,setLoading]=useState(true),[view,setView]=useState('home'),[modal,setModal]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[toast,setToast]=useState(''),[name,setName]=useState(''),[code,setCode]=useState(''),[value,setValue]=useState(''),[filter,setFilter]=useState('Все'),[today,setToday]=useState('');
 async function load(){try{const r=await fetch('/api/couple',{cache:'no-store'});const d:any=await r.json();if(!r.ok)throw Error(d.error);setData(d);if(d.me)setName(current=>current||d.me.name);setToday(calendarToday())}catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить данные.')}finally{setLoading(false)}}
 useEffect(()=>{load();const t=setInterval(()=>{if(!document.hidden)load()},20000);return()=>clearInterval(t)},[]);
 useEffect(()=>{setValue('');setError('')},[modal]);
 useEffect(()=>{if(!modal)return;const prev=document.activeElement as HTMLElement;const handler=(e:KeyboardEvent)=>{if(e.key==='Escape')setModal(null);if(e.key==='Tab'){const items=Array.from(document.querySelectorAll<HTMLElement>('.dialog button,.dialog input,.dialog textarea,.dialog a')).filter(el=>!el.hasAttribute('disabled'));const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}};document.body.style.overflow='hidden';document.addEventListener('keydown',handler);setTimeout(()=>document.querySelector<HTMLElement>('.dialog input,.dialog textarea,.dialog button')?.focus(),20);return()=>{document.body.style.overflow='';document.removeEventListener('keydown',handler);prev?.focus()}},[modal]);
 async function act(body:object,close=true){setBusy(true);setError('');try{const r=await fetch('/api/couple',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d:any=await r.json();if(!r.ok)throw Error(d.error);await load();if(close)setModal(null);return true}catch(e){setError(e instanceof Error?e.message:'Попробуйте ещё раз.');return false}finally{setBusy(false)}}
 function notify(s:string){setToast(s);setTimeout(()=>setToast(''),3000)}
 async function copy(){try{await navigator.clipboard.writeText(data.pair?.code||'');notify('Код скопирован. Отправьте его любимому человеку ♡')}catch{notify('Выделите код и скопируйте вручную.')}}
 function requirePair(target:string){setModal(data.pair?target:'pair')}
 const answers=data.answers||[],done=data.completed||[],my=answers.filter(a=>a.mine),both=my.filter(a=>answers.some(b=>!b.mine&&b.question===a.question)),tests=both.filter(a=>!a.question.startsWith('day:')),match=tests.length?Math.round(tests.filter(a=>answers.find(b=>!b.mine&&b.question===a.question)?.value===a.value).length/tests.length*100):null;
 const did=dailyId(),dailyMine=my.find(a=>a.question===did),dailyOther=answers.find(a=>a.question===did&&!a.mine);
 const pack=packs.find(p=>'pack:'+p.id===modal),idx=pack?pack.questions.findIndex((_,i)=>!my.some(a=>a.question===pack.id+':'+i)):-1,question=pack&&idx>=0?pack.questions[idx]:null;
 const date=dates.find(t=>'date:'+t.id===modal);
 function go(v:string){setView(v);setFilter('Все');window.scrollTo(0,0)}
 const featuredPacks=packs.slice(0,2);
 function PackCard({p}:{p:typeof packs[number]}){const n=my.filter(a=>a.question.startsWith(p.id+':')).length;return <button className={'pack '+p.color} onClick={()=>requirePair('pack:'+p.id)}><div className="packtop"><span className="packicon">{p.icon}</span><span className="pill">{p.tag}</span></div><h3>{p.title}</h3><p>{p.description}</p><div className="cardfoot"><span>5 вопросов · ~ 3 минуты</span><span>{n===5?'✓ Готово':n?`${n}/5`:'Начать'}</span></div></button>}
 function DateCard({d}:{d:typeof dates[number]}){return <button className="datecard" onClick={()=>setModal('date:'+d.id)}><span className="dateemoji">{d.icon}</span><div><span className="eyebrow">{d.time} · вдвоём</span><h3>{d.title}</h3><p>{d.description}</p></div>{done.includes(d.id)&&<CheckCircle2 size={21} className="doneicon"/>}</button>}
 function renderPairForm(){return <><span className="modalemoji">💌</span><p className="eyebrow">Всё начинается с вас двоих</p><h2>{data.pair?.partner?'Ваша пара':data.pair?'Код приглашения':'Давайте будем ближе'}</h2>{data.pair?<><p>{data.pair.partner?`Вы вместе с ${data.pair.partner}. Ваше место уже готово.`:'Отправьте этот код партнёру. После регистрации он сможет ввести его в своём аккаунте.'}</p>{!data.pair.partner&&<><button className="codebox" onClick={copy}>{data.pair.code}<Copy size={20}/></button><small>Код сформирован автоматически и действует до первого подключения.</small></>}</>:<><p>Создай пару и получи код приглашения или введи код партнёра.</p><button disabled={busy} className="primary full" onClick={()=>act({action:'create'},false)}><Plus size={18}/> Создать нашу пару</button><div className="divider">или у меня уже есть код</div><label>Код от партнёра<input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} maxLength={10} placeholder="10 букв и цифр" autoCapitalize="characters"/></label><button className="secondary full" disabled={busy||code.length!==10} onClick={()=>act({action:'join',code})}>Присоединиться</button></>}</>}
 async function logOut() {
   setBusy(true);
   try {
     const response = await fetch('/api/auth', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});
     if(!response.ok) throw new Error('Не удалось выйти. Попробуй ещё раз.');
     setData({signedIn:false});setName('');setCode('');setModal(null);go('home');
   } catch (error) {
     setError(error instanceof Error ? error.message : 'Не удалось выйти.');
   } finally {
     setBusy(false);
   }
 }
 if(loading) return <main className="account-screen"><p className="loadline"><LoaderCircle className="spin" size={18}/>Открываем «Рядом»…</p></main>;
 if(!data.signedIn) return <><AccountForm onSignedIn={load}/>{error&&<div className="toast" role="alert">{error}</div>}</>;
 const nextEvent = data.events?.find(event=>event.date>=today);
 return <div className="app">
 <aside className="sidebar">
   <a className="logo" href="/" aria-label="Рядом, главная"><Heart size={23} fill="currentColor"/></a>
   <nav aria-label="Разделы приложения">
     {nav.map(([id,title,Icon])=>(
       <button key={id} className={view===id?'active':''} aria-current={view===id?'page':undefined}
         aria-label={title} title={title} onClick={()=>go(id)}>
         <Icon size={22}/><span>{title}</span>
       </button>
     ))}
   </nav>
   <button className="settings" type="button" onClick={()=>setModal('settings')}
     title="Настройки" aria-label="Настройки"><Settings size={21}/><span>Настройки</span></button>
 </aside>
 <div className="mainwrap">
 <main>
   <header className="pageheading">
     <div>
       <h1>{view==='home'?<>Привет{data.me?', '+data.me.name:''}!</>:view==='questions'?'Вопросы и тесты':view==='dates'?'Маленькие свидания':view==='memories'?'Памятные даты':'Наши открытия'}</h1>
       {view==='home'&&<p>Ваше место для двоих</p>}
     </div>
     <button className="account" aria-label="Настроить пару" onClick={()=>setModal('pair')}>
       <span>{data.pair?.partner?'Наша пара':data.pair?'Пригласить партнёра':'Подключить пару'}</span>
       <span className="avatars"><span>{data.me?.name?.[0]||'Я'}</span><span>{data.pair?.partner?.[0]||'Ты'}</span></span>
     </button>
   </header>
   {loading&&<p className="loadline"><LoaderCircle className="spin" size={16}/> Открываем ваше пространство…</p>}
   {!modal&&error&&<div className="error" role="alert">{error}<button className="textbtn" onClick={load}>Повторить</button></div>}
   {view==='home'&&<div className="dashboard">
     <div className="dashboard-main">
       <section>
         <div className="sectiontitle"><h2>Вопросы и тесты</h2><button className="textbtn" onClick={()=>go('questions')}>Все тесты</button></div>
         <div className="packgrid">{featuredPacks.map(p=><PackCard key={p.id} p={p}/>)}</div>
       </section>
       <section>
         <div className="sectiontitle"><h2>Наши открытия</h2><button className="textbtn" onClick={()=>go('results')}>История</button></div>
         <div className="stats">
           <div className="stat sky"><MessagesSquare size={19}/><b>{both.length}</b><span>общих ответов</span></div>
           <div className="stat leaf"><Heart size={19}/><b>{match===null?'—':match+'%'}</b><span>совпадения</span></div>
           <div className="stat lavender"><Sparkles size={19}/><b>{done.length}</b><span>свиданий</span></div>
         </div>
       </section>
       <section className="pairpanel">
         <span className="pairheart">{data.pair?.photoVersion ? <img src={'/api/couple/photo?v='+data.pair.photoVersion} alt="" /> : <CalendarHeart size={23}/>}</span>
         <div>
           <h2>{data.pair?.startDate ? daysLabel(Math.max(0,daysBetween(data.pair.startDate,today)))+' вместе' : 'Ваши памятные даты'}</h2>
           <p>{nextEvent ? nextEvent.title + ' · ' + (nextEvent.date===today?'сегодня':'через '+daysLabel(daysBetween(today,nextEvent.date))) : 'Дата начала отношений и ближайшие события'}</p>
         </div>
         <button className="primary" onClick={()=>go('memories')}>Открыть</button>
       </section>
       <section className="pairpanel">
         <span className="pairheart" aria-hidden="true"><Heart fill="currentColor"/></span>
         <div>
           <h2>{data.pair?.partner?'Ваша пара':data.pair?'Пригласи партнёра':'Создайте пару'}</h2>
           <p>{data.pair?.partner?data.me?.name+' и '+data.pair.partner:data.pair?'Отправь код, чтобы открыть общее пространство.':'Один код свяжет ваши аккаунты.'}</p>
         </div>
         <button className="primary" onClick={()=>setModal('pair')}>{data.pair?'Открыть':'Начать'}</button>
       </section>
     </div>
     <div className="dashboard-side">
       <section>
         <div className="sectiontitle"><h2>Вопрос дня</h2></div>
         <div className="dailycard">
           <span className="dailyicon"><MessagesSquare size={22}/></span>
           <h3>{dailyText(did)}</h3>
           <p>{dailyMine?(dailyOther?'Вы оба ответили':'Ждём ответ партнёра'):'Ответы откроются, когда ответите оба.'}</p>
           <button className="primary" onClick={()=>requirePair('daily')}>{dailyMine?'Посмотреть ответы':'Ответить'}</button>
         </div>
       </section>
       <section>
         <div className="sectiontitle"><h2>Маленькие свидания</h2><button className="textbtn" onClick={()=>go('dates')}>Все идеи</button></div>
         <div className="dategrid">{dates.slice(0,2).map(d=><DateCard key={d.id} d={d}/>)}</div>
       </section>
     </div>
   </div>}
 {view==='memories'&&(data.pair?<RelationshipPanel pair={data.pair} events={data.events||[]} today={today}
   save={body=>act(body,false)} busy={busy}/>:<div className="empty"><CalendarHeart size={32}/>
   <h2>Ваш общий календарь</h2><p>Создай пару, чтобы сохранить фото и памятные даты.</p>
   <button className="primary" onClick={()=>setModal('pair')}>Подключить пару</button></div>)}
 {view==='questions'&&<><div className="filters">{['Все','Легко и весело','Про нас','Помечтаем','Поговорим ближе'].map(f=><button key={f} className={f===filter?'selected':''} onClick={()=>setFilter(f)}>{f}</button>)}</div><div className="packgrid fullgrid">{packs.filter(p=>filter==='Все'||p.tag===filter).map(p=><PackCard key={p.id} p={p}/>)}</div><div className="softnote"><Heart size={20}/><p>Совпадать во всём необязательно. Разные ответы — отличный повод узнать друг друга лучше.</p></div></>}
 {view==='dates'&&<><div className="softnote"><Sparkles size={23}/><p>Выберите идею, договоритесь о времени и включите видеосвязь. Когда закончите — сохраните ваше маленькое свидание.</p></div><div className="dategrid all">{dates.map(d=><DateCard key={d.id} d={d}/>)}</div></>}
 {view==='results'&&<><section className="resultbanner"><Heart size={30}/><div><h2>{match===null?'Впереди столько открытий':`Вы совпали в ${match}% ответов`}</h2><p>{match===null?'Пройдите один тест вдвоём, чтобы увидеть совпадения.':`Сравнили ${tests.length} ответов с выбором варианта. Это игра, а не оценка ваших отношений.`}</p></div></section>{my.length===0?<div className="empty"><span>♡</span><h2>Здесь будет ваша история</h2><p>Один вопрос, два ответа — и вы уже знаете друг друга чуточку лучше.</p><button className="primary" onClick={()=>go('questions')}>Выбрать первый тест</button></div>:<div className="answerslist">{my.map(a=>{const other=answers.find(b=>!b.mine&&b.question===a.question);const [p,i]=a.question.split(':');const label=p==='day'?dailyText(a.question):packs.find(x=>x.id===p)?.questions[Number(i)]?.[0];return <article className="answercard" key={a.question}><h3>{label}</h3><div className="answercolumns"><div><span>Ты</span><p>{a.value}</p></div><div><span>{data.pair?.partner||'Партнёр'}</span><p>{other?.value||'Пока думает над ответом ♡'}</p></div></div>{other&&!a.question.startsWith('day:')&&<small>{other.value===a.value?'♡ Есть совпадение!':'Два взгляда — повод поговорить'}</small>}</article>})}</div>}{done.length>0&&<section><div className="sectiontitle"><h2>Уже сделали вместе</h2></div><div className="dategrid">{dates.filter(d=>done.includes(d.id)).map(d=><DateCard key={d.id} d={d}/>)}</div></section>}</>}
 </main></div>
 {modal&&<div className="overlay" onClick={e=>{if(e.target===e.currentTarget)setModal(null)}}><section className="dialog" role="dialog" aria-modal="true" aria-label="Ваше пространство"><button className="close iconbtn" aria-label="Закрыть" onClick={()=>setModal(null)}><X size={21}/></button>
 {modal==='pair'&&renderPairForm()}
 {modal==='daily'&&<><span className="modalemoji">💬</span><p className="eyebrow">ВОПРОС ДНЯ</p><h2>{dailyText(did)}</h2>{dailyMine?<><div className="answercard"><span className="eyebrow">ТВОЙ ОТВЕТ</span><p>{dailyMine.value}</p></div><div className="answercard"><span className="eyebrow">{data.pair?.partner||'ПАРТНЁР'}</span><p>{dailyOther?.value||'Ответ ещё не появился. Самое интересное впереди ♡'}</p></div></>:<><p>Расскажи, что первым пришло в голову. После отправки ответ сохранится, и его уже нельзя будет изменить.</p><label>Твой ответ<textarea rows={4} maxLength={2000} value={value} onChange={e=>setValue(e.target.value)} placeholder="Если бы ты сейчас был(а) рядом…"/></label><button className="primary full" disabled={!value.trim()||busy} onClick={async()=>{if(await act({action:'answer',question:did,value},false))notify('Ответ сохранён ♡')}}>Сохранить мой ответ</button></>}</>}
 {pack&&<><span className="modalemoji">{pack.icon}</span><p className="eyebrow">{pack.tag} · {idx<0?'ГОТОВО':`ВОПРОС ${idx+1} ИЗ 5`}</p><h2>{question?question[0]:'Ты ответил(а) на все вопросы ♡'}</h2><div className="progress"><i style={{width:`${(idx<0?5:idx)/5*100}%`}}/></div>{question?<><div className="options">{question.slice(1).map(o=><button className={value===o?'chosen':''} key={o} onClick={()=>setValue(o)}>{o}{value===o&&<Check size={18}/>}</button>)}</div><small>После отправки ответ нельзя изменить. Ответ партнёра появится в «Наших открытиях».</small><button className="primary full" disabled={!value||busy} onClick={async()=>{if(await act({action:'answer',question:pack.id+':'+idx,value},false))setValue('')}}>{idx===4?'Завершить тест':'Сохранить и продолжить'}</button></>:<><p>Когда партнёр тоже ответит, вы сможете сравнить ваши ответы. Все сохранённые ответы уже в ваших открытиях.</p><button className="primary full" onClick={()=>{setModal(null);go('results')}}>Посмотреть наши открытия</button></>}</>}
 {date&&<><span className="modalemoji">{date.icon}</span><p className="eyebrow">{date.time} · МАЛЕНЬКОЕ СВИДАНИЕ</p><h2>{date.title}</h2><p className="dateinstructions">{date.description}</p><div className="softnote"><Heart size={20}/><p>Заранее договоритесь о времени. Ваша единственная задача — побыть вместе.</p></div><button className="primary full" disabled={busy||done.includes(date.id)} onClick={()=>data.pair?act({action:'task',task:date.id}):setModal('pair')}>{done.includes(date.id)?'✓ Сохранили в вашей истории':'Мы сделали это вместе'}</button></>}
 {modal==='settings'&&<><span className="modalemoji">🏡</span><h2>Наше пространство</h2>{data.signedIn?<><label>Твоё имя<input maxLength={40} value={name} onChange={e=>setName(e.target.value)}/></label><button className="primary full" disabled={busy||!name.trim()} onClick={()=>act({action:'profile',name})}>Сохранить имя</button>{data.pair&&<button className="secondary full" onClick={()=>setModal('pair')}>Пара и код приглашения</button>}<button className="textbtn logout" disabled={busy} onClick={logOut}>Выйти из аккаунта</button></>:<><p>Войдите, чтобы создать своё пространство и сохранять общую историю.</p><button className="primary full" onClick={()=>setModal('pair')}>Начнём знакомство</button></>}<small>В этой версии: 4 теста, вопрос дня и 6 идей для свиданий. Новые ответы проверяются каждые 20 секунд.</small></>}
 {busy&&<p className="loadline"><LoaderCircle size={16} className="spin"/> Сохраняем…</p>}{error&&<p className="error" role="alert">{error}</p>}
 </section></div>}{toast&&<div className="toast" role="status"><Check size={18}/>{toast}</div>}</div>
}
