import 'server-only';
import {createHash} from 'node:crypto';
import type {Firestore} from 'firebase-admin/firestore';
import type {GameState} from './game-data.ts';
import {resourceId,type CommunityActor} from './community.ts';
import {isCommunityOwner} from './community-authority.ts';
import {assertLeagueAccess,leagueMember} from './league-access.ts';
import {canonicalJson} from './score-ledger.ts';
import {mayViewConfirmedJuryResults,playerJuryResults,confirmedAccuracy,juryQuestionAccuracy} from './jury-results.ts';
import {JuryError,JURY_RULES_VERSION,activationPreview,answerKey,applyJuryAwards,assertSnapshotMergeHistory,confirmedFacts,eligibleForEpisode,eliminationSource,emptyFacts,gradePrediction,juryEligibility,playerSnapshot,saveJuryAnswer,suggestedFacts,validateSnapshot,type JuryConfig,type JuryEpisode,type JuryFacts,type JuryPrediction,type JurySnapshot,type QuestionId,type Reconciliation} from './jury.ts';

const digest=(value:unknown)=>createHash('sha256').update(canonicalJson(value)).digest('hex');
const episodeId=(season:number,episode:number)=>`${season}-${episode}`;
function commissioner(actor:CommunityActor){if(!isCommunityOwner(actor))throw new JuryError('Only the verified game master can manage Jury Mode.',403);}
function revision(value:unknown,expected:number){if(value!==expected)throw new JuryError('This record changed. Refresh and review again.');}
function episodeNumber(value:unknown){if(!Number.isSafeInteger(value)||Number(value)<1||Number(value)>999)throw new JuryError('Choose a valid episode.',400);return Number(value);}

export class JuryStore {
  readonly db:Firestore;readonly actor:CommunityActor;readonly clock:()=>string;
  constructor(db:Firestore,actor:CommunityActor,clock=()=>new Date().toISOString()){this.db=db;this.actor=actor;this.clock=clock;}
  private root(){return this.db.doc('games/survivor-51');}
  async catalog(admin=false){
    if(admin)commissioner(this.actor);
    return this.db.runTransaction(async tx=>{
    const root=this.root(),gameDoc=await tx.get(root);if(!gameDoc.exists)throw new JuryError('The league is not initialized.');
    const game=gameDoc.data() as GameState;assertLeagueAccess(game,this.actor);
    const [configDoc,episodes,rows]=await Promise.all([tx.get(root.collection('juryConfig').doc(String(game.season.number))),tx.get(root.collection('juryEpisodes').where('season','==',game.season.number)),tx.get(root.collection('juryPredictions').where(admin?'season':'ownerUid','==',admin?game.season.number:this.actor.uid))]);
    const config=configDoc.exists?configDoc.data() as JuryConfig:null,now=this.clock();
    const predictions=rows.docs.map(d=>d.data() as JuryPrediction).filter(p=>p.season===game.season.number);
    if(admin){
      const audits=await tx.get(root.collection('juryAudit').where('season','==',game.season.number));
      return {serverTime:now,config,preview:activationPreview(game,config?.activationEpisode??null,config),episodes:episodes.docs.map(d=>d.data() as unknown as JuryEpisode).sort((a,b)=>a.snapshot.episode-b.snapshot.episode),predictions,audits:audits.docs.map(d=>d.data()).sort((a,b)=>String(b.at).localeCompare(String(a.at)))};
    }
    const player=leagueMember(game,this.actor),eligibility=juryEligibility(game,player.id,config?.reconciliations);
    const visible=episodes.docs.map(d=>d.data() as unknown as JuryEpisode).filter(e=>eligibleForEpisode(game,config,player.id,e.snapshot.episode)||predictions.some(p=>p.episode===e.snapshot.episode));
    // Read private grading rows only on the server, and only if this viewer can see confirmed results.
    const needsAccuracy=visible.some(e=>!confirmedAccuracy(e)&&mayViewConfirmedJuryResults(e,predictions.find(p=>p.playerId===player.id&&p.episode===e.snapshot.episode)??null,now));
    const gradingRows=needsAccuracy?(await tx.get(root.collection('juryPredictions').where('season','==',game.season.number))).docs.map(d=>d.data() as JuryPrediction):[];
    return {serverTime:now,enabled:config?.enabled??false,eligibility,episodes:visible.sort((a,b)=>b.snapshot.episode-a.snapshot.episode).map(e=>{
      const prediction=predictions.find(p=>p.playerId===player.id&&p.episode===e.snapshot.episode)??null,locked=Date.parse(now)>=Date.parse(e.snapshot.airtime);
      const eligible=eligibleForEpisode(game,config?{...config,enabled:true}:null,player.id,e.snapshot.episode);
      let snapshotNeedsReview=false;try{assertSnapshotMergeHistory(e.snapshot,game);}catch{snapshotNeedsReview=true;}
      return {snapshot:playerSnapshot(e.snapshot),prediction,locked,canSave:!locked&&eligible&&!snapshotNeedsReview&&Boolean(config?.enabled)&&!game.season.finalized,status:snapshotNeedsReview?'Snapshot needs Game Master review':e.gradedAt&&e.confirmedEvidenceRevision===e.revision?'Graded':e.facts.provenance?'Awaiting Game Master Confirmation':'Awaiting Results',grade:locked&&e.key&&e.gradedAt&&prediction?prediction.grade??null:null,results:playerJuryResults(e,prediction,gradingRows,now),eligibilityNeedsReview:!eligible};
    })};
    },{readOnly:true});
  }
  async mutate(input:Record<string,unknown>){
    if(input.action!=='save-answer')commissioner(this.actor);
    const root=this.root(),id=resourceId(input.requestId),auditRef=root.collection('juryAudit').doc(id);
    const requestHash=digest(input);
    return this.db.runTransaction(async tx=>{
      const [gameDoc,oldReceipt]=await Promise.all([tx.get(root),tx.get(auditRef)]);
      if(!gameDoc.exists)throw new JuryError('The league is not initialized.');
      const game=gameDoc.data() as GameState;assertLeagueAccess(game,this.actor);
      const season=episodeNumber(input.season);if(season!==game.season.number)throw new JuryError('The active season changed.');
      if(oldReceipt.exists){const r=oldReceipt.data()!;if(r.actorUid!==this.actor.uid||r.requestHash!==requestHash)throw new JuryError('This request ID is already used.');return {ok:true,alreadyApplied:true};}
      if(game.season.finalized)throw new JuryError('Final standings are locked.');
      const configRef=root.collection('juryConfig').doc(String(season)),configDoc=await tx.get(configRef),config=configDoc.exists?configDoc.data() as JuryConfig:null;
      const at=this.clock(); // Read again inside every Firestore retry, never use a client timestamp.
      const receipt=(details:object)=>({season,actorUid:this.actor.uid,at,requestHash,action:input.action,...details});
      if(input.action==='configure'){
        revision(input.expectedRevision,config?.revision??0);
        const activationEpisode=episodeNumber(input.activationEpisode),firstDoc=await tx.get(root.collection('juryEpisodes').doc(episodeId(season,activationEpisode)));
        if(typeof input.enabled!=='boolean'||typeof input.approval!=='string'||input.approval.trim().length<10)throw new JuryError('Record the explicit commissioner activation or pause decision.',400);
        if(config?.activatedAt&&activationEpisode!==config.activationEpisode)throw new JuryError('The original activation episode is immutable. Open additional future snapshots instead.');
        if(input.enabled&&(!firstDoc.exists||(!config?.activatedAt&&Date.parse((firstDoc.data() as unknown as JuryEpisode).snapshot.airtime)<=Date.parse(at))))throw new JuryError('Verify the first future snapshot before approving activation.');
        if(!Array.isArray(input.reconciliations))throw new JuryError('Review historical reconciliation records.',400);
        const reconciliations:Reconciliation[]=input.reconciliations.map((raw:Reconciliation)=>{
          const cast=game.castaways.find(c=>c.id===raw.castawayId);
          if(!cast||cast.status!=='voted-out'||cast.eliminationEpisode!==undefined||!Number.isSafeInteger(raw.episode)||raw.episode<1||raw.episode>game.season.currentEpisode||typeof raw.provenance!=='string'||raw.provenance.trim().length<10)throw new JuryError('Reconcile only missing historical elimination episodes with verified provenance.',400);
          return {castawayId:cast.id,episode:raw.episode,provenance:raw.provenance.trim(),source:eliminationSource(cast)};
        });
        if(new Set(reconciliations.map(r=>r.castawayId)).size!==reconciliations.length)throw new JuryError('Duplicate historical reconciliations.',400);
        const next:JuryConfig={season,enabled:input.enabled,activationEpisode,...(config?.activatedAt||input.enabled?{activatedAt:config?.activatedAt??at}:{}),revision:(config?.revision??0)+1,approvedAt:at,approvedBy:this.actor.uid,approval:input.approval.trim(),reconciliations};
        const missing=game.players.filter(p=>p.active!==false).map(p=>juryEligibility(game,p.id,reconciliations)).filter(e=>e.slots.length===3&&e.slots.every(id=>game.castaways.find(c=>c.id===id)?.status==='voted-out')&&e.issues.length);
        if(next.enabled&&missing.length)throw new JuryError('Resolve missing elimination history for every fully eliminated roster before activation.');
        tx.set(configRef,next);
        tx.update(root,{juryMode:{enabled:next.enabled,activationEpisode,reviewedEliminations:reconciliations.map(r=>({castawayId:r.castawayId,episode:r.episode,source:r.source}))}});
        tx.create(auditRef,receipt({before:config,after:next}));return {ok:true};
      }
      const episode=episodeNumber(input.episode),ref=root.collection('juryEpisodes').doc(episodeId(season,episode)),doc=await tx.get(ref),record=doc.exists?doc.data() as unknown as JuryEpisode:null;
      if(input.action==='snapshot'){
        if(record)throw new JuryError('This immutable episode snapshot already exists.');
        const snapshot=validateSnapshot(input.snapshot as JurySnapshot,game,at);
        if(snapshot.episode!==episode)throw new JuryError('Snapshot episode mismatch.',400);
        const created:JuryEpisode={snapshot,facts:emptyFacts(),revision:1,key:null,keyRevision:0,confirmedAt:null,confirmedBy:null,gradedAt:null};
        tx.create(ref,{season,...created});tx.create(auditRef,receipt({snapshot}));return {ok:true};
      }
      if(!record)throw new JuryError('The game master must verify this episode snapshot first.');
      if(input.action==='save-answer'){
        assertSnapshotMergeHistory(record.snapshot,game);
        const player=leagueMember(game,this.actor),pRef=root.collection('juryPredictions').doc(episodeId(season,episode)+'_'+player.id),saved=await tx.get(pRef);
        if(!eligibleForEpisode(game,config,player.id,episode))throw new JuryError('Jury eligibility or activation is not confirmed for this episode.',403);
        const eligibility=juryEligibility(game,player.id,config?.reconciliations);
        const prediction:JuryPrediction=saved.exists?saved.data() as JuryPrediction:{season,episode,playerId:player.id,ownerUid:this.actor.uid,snapshotVersion:record.snapshot.version,answers:{},revision:0,eligibility:{fromEpisode:eligibility.fromEpisode!,slots:eligibility.slots}};
        if(prediction.ownerUid!==this.actor.uid)throw new JuryError('Prediction ownership needs commissioner review.',403);
        const next=saveJuryAnswer(record.snapshot,prediction,input.question as QuestionId,input.value as string,input.expectedRevision as number,id,this.clock());
        tx.set(pRef,next);tx.create(auditRef,receipt({episode,playerId:player.id,before:prediction,after:next}));return {ok:true,prediction:next};
      }
      if(input.action==='evidence'){
        revision(input.expectedRevision,record.revision);
        const facts=confirmedFacts(input.facts as JuryFacts,record.snapshot,game);
        // Draft evidence can be complete without confirming a key. Existing grades stay authoritative until an explicit correction.
        tx.update(ref,{facts,revision:record.revision+1});tx.create(auditRef,receipt({episode,before:record.facts,after:facts}));return {ok:true,suggestedKey:answerKey(record.snapshot,facts)};
      }
      if(input.action==='preview-grade'||input.action==='confirm-grade'){
        revision(input.expectedRevision,record.revision);
        if(Date.parse(this.clock())<Date.parse(record.snapshot.airtime))throw new JuryError('Confirm results only after broadcast locking.');
        if(!config)throw new JuryError('Jury activation has not been configured.');
        const facts=confirmedFacts(record.facts,record.snapshot,game),key=answerKey(record.snapshot,facts),keyRevision=record.keyRevision+1;
        const rows=await tx.get(root.collection('juryPredictions').where('season','==',season)),predictions=rows.docs.map(d=>d.data() as JuryPrediction).filter(p=>p.episode===episode);
        const next=applyJuryAwards(game,record.snapshot,predictions,key,keyRevision,{...config,enabled:true},at);
        const awards=predictions.map(p=>{const eligible=eligibleForEpisode(game,{...config,enabled:true},p.playerId,episode),calculated=gradePrediction(record.snapshot,p,key,keyRevision);return {playerId:p.playerId,eligible,answered:Object.keys(p.answers).length,grade:eligible?calculated:{...calculated,points:{q1:0,q2:0,q3:0,q4:0,q5:0},cleanSweep:0,total:0},previousPoints:game.scoreEvents.filter(e=>e.id.startsWith(`jury:${season}:${episode}:${p.playerId}:`)).reduce((s,e)=>s+e.points,0)};});
        const previewToken=digest({record,config,game,predictions,key});
        if(input.action==='preview-grade')return {ok:true,key,awards,previewToken,keyRevision};
        if(input.previewToken!==previewToken||input.confirmed!==true)throw new JuryError('Review the current five-question key and affected awards before confirming.');
        tx.update(root,{scoreEvents:next.scoreEvents,scoringRevision:(game.scoringRevision??0)+1});
        const gradedRows=predictions.map(p=>{const award=awards.find(a=>a.playerId===p.playerId)!;return {...p,grade:award.grade,gradingEligible:award.eligible,gradedAt:at};});
        const accuracy={keyRevision,gradedAt:at,questions:juryQuestionAccuracy({...record,keyRevision,gradedAt:at},gradedRows)};
        tx.update(ref,{key,keyRevision,confirmedAt:at,confirmedBy:this.actor.uid,gradedAt:at,revision:record.revision+1,confirmedEvidenceRevision:record.revision+1,accuracy});
        for(const award of awards)tx.update(root.collection('juryPredictions').doc(episodeId(season,episode)+'_'+award.playerId),{grade:award.grade,gradingEligible:award.eligible,gradedAt:at});
        tx.create(auditRef,receipt({episode,beforeKey:record.key,afterKey:key,keyRevision,awards,previewToken}));return {ok:true,keyRevision};
      }
      throw new JuryError('Unknown Jury action.',400);
    });
  }
  async suggestion(episode:number){
    commissioner(this.actor);const root=this.root(),gameDoc=await root.get();if(!gameDoc.exists)throw new JuryError('League not initialized.');
    const game=gameDoc.data() as GameState,record=await root.collection('juryEpisodes').doc(episodeId(game.season.number,episode)).get();
    if(!record.exists)throw new JuryError('Verify the snapshot first.');
    return suggestedFacts(game,(record.data() as unknown as JuryEpisode).snapshot);
  }
}

export const juryRulesVersion=JURY_RULES_VERSION;
