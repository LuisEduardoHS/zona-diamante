// Visual projection only. All statistics, pitch plans and economic outcomes
// arrive from FastAPI/PostgreSQL. No local classifySwing/advance is used here.
export function officialJournal(storage, user) {
    const key='zd:game:official:'+user;
    return {
        read(){const raw=storage.getItem(key);try{return raw?JSON.parse(raw):null;}catch{return null;}},
        write(row){storage.setItem(key,JSON.stringify(row));},
    };
}
export function projectOfficial(s, time, busy=false, pendingSwing=null, animationElapsed=null) {
    const elapsed=s.pitch_start == null ? 0 : Math.max(0,time-s.pitch_start);
    let phase=s.phase, pausedFrom=null, last=s.last;
    const renderPhase=p=>{
        if(p==='completed')return last && time<last.resolved_at+600?'feedback':'finished';
        if(p==='ready'||p==='waiting')return last?'feedback':'preparing';
        if(p==='pitch'&&time<s.pitch_start)return 'countdown';
        return p;
    };
    if(phase==='paused'){pausedFrom=renderPhase(s.paused_from);phase='paused';}else phase=renderPhase(phase);
    const effective=phase==='paused'?pausedFrom:phase;
    let localElapsed=effective==='countdown'?s.rules.timing.countdownMs-Math.max(0,(s.pitch_start??time+1000)-time)
        :effective==='feedback'?Math.max(0,time-(last?.resolved_at??time)):elapsed;
    if(pendingSwing!==null&&s.phase==='pitch'){
        phase='feedback';localElapsed=Math.max(0,time-pendingSwing);last={type:'pending',at:pendingSwing-s.pitch_start,duration:600};
    }
    if(effective==='feedback'&&animationElapsed!==null)localElapsed=animationElapsed;
    return {id:s.id,mode:s.mode,phase,pausedFrom,elapsed:localElapsed,plan:s.plan,
        pitchIndex:s.plan?.index??0,last,stats:s.stats,outcome:s.outcome,serverBusy:busy,
        official:true,serverResult:s};
}

export function createOfficialEngine({api,storage,user,mode,rules,fresh=false,
    now=()=>performance.now(),requestFrame=fn=>requestAnimationFrame(fn),cancelFrame=id=>cancelAnimationFrame(id),
    setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id),
    onFrame=()=>{},onError=()=>{},onSnapshot=()=>{}}) {
    const journal=officialJournal(storage,user),abort=new AbortController(),signal=abort.signal;
    let snap=null,anchor=0,state=null,frame=null,alive=true,busy=false,started=false,fault=false,pendingSwing=null;
    let inFlight=Promise.resolve(),lastPoll=0,swingAnimation=null,wakeTimer=null;
    const serverTime=()=>snap.server_now+Math.max(0,now()-anchor);
    function emit(){if(!alive||!snap)return;const animationElapsed=swingAnimation&&snap.last?.pitch_id===swingAnimation.pitchId?Math.max(0,now()-swingAnimation.started):null;
        state=projectOfficial(snap,serverTime(),busy,pendingSwing,animationElapsed);
        if(fault){state={...state,phase:'paused',pausedFrom:state.phase,serverBusy:true,networkError:true};}
        onFrame(state);}
    function apply(value){if(!alive)return;if(swingAnimation&&value.pitch_id!==swingAnimation.pitchId)swingAnimation=null;snap=value;anchor=now();pendingSwing=null;fault=false;onSnapshot(value);emit();}
    async function invoke(fn) {
        try{return await fn();}catch(error){
            if(signal.aborted)throw error;
            if(!error.status||error.status>=500)return await fn(); // same closure/key, never a new operation
            throw error;
        }
    }
    function send(fn) {
        if(!alive||busy)return inFlight;
        busy=true;emit();
        inFlight=(async()=>{
            try{apply(await invoke(fn));return true;}
            catch(error){
                if(!alive||signal.aborted)return false;
                let failure=error;
                if(error.status===409&&!String(error.message).includes('latency')&&snap){try{apply(await api.read(snap.id,signal));return true;}catch(readError){failure=readError;}}
                fault=true;pendingSwing=null;onError(failure);return false;
            }finally{busy=false;emit();schedule();}
        })();return inFlight;
    }
    function pump(){
        if(!alive||!snap||busy||fault)return;
        const t=serverTime(),s=snap;
        if(s.phase==='ready'){const key=crypto.randomUUID();void send(()=>api.complete(s.id,key,signal));return;}
        if(snap.phase==='waiting'){
            if(s.samples.length<3){const key=crypto.randomUUID();void send(()=>api.probe(s.id,s.probe,s.revision,key,signal));return;}
            if(t>=s.next_at){const key=crypto.randomUUID();void send(()=>api.nextPitch(s.id,s.revision,key,signal));return;}
        }
        if((snap.phase==='pitch'&&t>snap.pitch_start+snap.plan.flightMs+snap.compensation_ms)
            ||snap.phase==='paused'&&now()-lastPoll>=1000
            ||['waiting','pitch','paused','ready'].includes(snap.phase)&&t>=snap.expires_at){
            lastPoll=now();void send(()=>api.read(snap.id,signal));
        }
    }
    function schedule(){
        const idle=!alive||!snap||fault||['finished','abandoned','expired'].includes(state?.phase);
        if(idle||state?.phase==='paused'){
            if(frame!==null){cancelFrame(frame);frame=null;}
            if(idle){if(wakeTimer!==null)clearTimer(wakeTimer);wakeTimer=null;return;}
            // Keep server expiry/deadline reconciliation, without redrawing a
            // stationary arena at 60/120 Hz while paused or in the background.
            if(wakeTimer===null)wakeTimer=setTimer(()=>{wakeTimer=null;loop();},1000);
            return;
        }
        if(wakeTimer!==null){clearTimer(wakeTimer);wakeTimer=null;}
        if(frame===null)frame=requestFrame(loop);
    }
    function loop(){frame=null;if(!alive)return;emit();pump();schedule();}
    async function boot(retry=false){
        busy=true;fault=false;const newIntent=fresh&&!retry;
        try{
            let row=journal.read(),existing=null;
            const pendingIntent=row?.key&&!row.id&&row.mode===mode;
            if(!newIntent&&!pendingIntent){
                if(row?.id){try{existing=await api.read(row.id,signal);}catch(e){if(![404,422].includes(e.status))throw e;}}
                else existing=await api.current(signal);
                if(existing&&['abandoned','expired'].includes(existing.phase))existing=null;
            }
            if(!existing){
                if(newIntent||!row?.key||row.mode!==mode||row.id)row={key:crypto.randomUUID(),mode};
                journal.write(row); // fail before official start if recovery cannot be retained
                try{existing=await invoke(()=>api.start(mode,row.key,signal));}
                catch(e){if(e.status!==409)throw e;existing=await api.current(signal);if(!existing)throw e;}
            }
            if(!alive)return;
            journal.write({key:row?.key||'',mode:existing.mode,id:existing.id});apply(existing);
        }catch(error){if(alive&&!signal.aborted){fault=true;onError(error);}}
        finally{busy=false;emit();schedule();}
    }
    async function transition(action){
        await inFlight;if(!alive||!snap)return false;
        const target={pause:'paused',resume:null,abandon:'abandoned'}[action];
        for(let attempt=0;attempt<2;attempt++){
            if(action==='pause'&&snap.phase==='paused')return true;
            if(action==='resume'&&['pitch','waiting','ready'].includes(snap.phase))return true;
            if(['completed','abandoned','expired'].includes(snap.phase))return action==='abandon';
            const s=snap,key=crypto.randomUUID();
            const ok=await send(()=>api.transition(s.id,action,s.revision,key,signal));
            if(!ok||fault)return false;
            if(action==='resume'?snap.phase!=='paused':snap.phase===target)return true;
            // A deadline can resolve during the command. GET reconciles the
            // new revision; retry the intended transition once against it.
        }
        return false;
    }
    return {
        get state(){return state;},
        start(){if(started)return;started=true;inFlight=boot();return inFlight;},
        swing(){if(!snap||busy||fault||state?.phase!=='pitch')return false;
            const s=snap,key=crypto.randomUUID();pendingSwing=serverTime();
            swingAnimation={pitchId:s.pitch_id,started:now()};
            void send(()=>api.swing(s.id,s.pitch_id,s.revision,key,signal));return true;},
        pause(){if(fault)return Promise.resolve(false);return transition('pause');},
        async resume(){await inFlight;if(!alive)return false;
            if(!snap&&fault){inFlight=boot(true);await inFlight;return Boolean(snap)&&!fault;}
            if(!snap)return false;
            if(fault){fault=false;return send(()=>api.read(snap.id,signal));}
            return transition('resume');},
        abandon(){return transition('abandon');},
        destroy(){if(!alive)return;alive=false;abort.abort();if(frame!==null)cancelFrame(frame);frame=null;if(wakeTimer!==null)clearTimer(wakeTimer);wakeTimer=null;},
    };
}
