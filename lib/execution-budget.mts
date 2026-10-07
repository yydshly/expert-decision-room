/** One bounded run. Deployment must also use a durable, atomic owner-level reservation. */
export type BudgetConfig={approved:boolean;maxCalls:number;maxInputBytes:number;maxOutputTokens:number;maxCostMicros:number;inputMicrosPerToken:number;outputMicrosPerToken:number;minIntervalMs:number};
export class ExecutionBudget {
 private calls=0;private reserved=0;private lastCall:number|null=null;
 private config:BudgetConfig;
 constructor(config:BudgetConfig){this.config={...config};if(!config.approved)throw new Error('BUDGET_NOT_APPROVED');for(const [k,v] of Object.entries(config)){if(k!=='approved'&&(!Number.isSafeInteger(v)||(v as number)<0))throw new Error('INVALID_BUDGET');}if(config.maxCalls<1||config.maxCalls>6||config.maxOutputTokens<1||config.maxCostMicros<1||config.inputMicrosPerToken<1||config.outputMicrosPerToken<1)throw new Error('INVALID_BUDGET');}
 reserve(inputBytes:number,outputTokens:number,now=Date.now()){
  if(!Number.isSafeInteger(inputBytes)||inputBytes<0||!Number.isSafeInteger(outputTokens)||outputTokens<1)throw new Error('INVALID_RESERVATION');
  if(inputBytes>this.config.maxInputBytes||outputTokens>this.config.maxOutputTokens)throw new Error('TOKEN_LIMIT');
  if(this.calls>=this.config.maxCalls)throw new Error('CALL_LIMIT');
  if(this.lastCall!==null&&now-this.lastCall<this.config.minIntervalMs)throw new Error('RATE_LIMIT');
  // UTF-8 bytes plus conservative provider framing reserve; uncached price, rounded up.
  const cost=(inputBytes+1024)*this.config.inputMicrosPerToken+outputTokens*this.config.outputMicrosPerToken;
  if(this.reserved+cost>this.config.maxCostMicros)throw new Error('COST_LIMIT');
  this.calls++;this.reserved+=cost;this.lastCall=now;return {call:this.calls,reservedCostMicros:cost};
 }
 snapshot(){return {calls:this.calls,reservedCostMicros:this.reserved};}
}
