import { NS } from "@ns";
import { SECURITY } from "./lib/constants";

export async function main(ns: NS): Promise<void> {
  const target = ns.args[0] as string;
  if (target == null) return;

  const lines = ['target,threads,h,wh,g,wg,score'];

  const data = [];
  for (let hacks = 1; hacks <= 200; hacks++) {
    data.push(calculateWith(hacks));
  }
  data.sort((lhs, rhs) => (rhs[6] as number) - (lhs[6] as number));
  lines.push(...data.map((x) => x.join(',')));

  ns.write(`research-${target}.csv.txt`, lines.join('\n'), 'w');

  const hacksOptimal = data[0][2];
  ns.tprint(`optimal: ${hacksOptimal}`)

  function calculateWith(hacks: number) {
    const hackAmount = ns.hackAnalyze(target);
    const hacksMax = Math.floor(0.99 / hackAmount);
    const hacksPerBatch = Math.min(hacks, hacksMax);
    const weakensForHacks = Math.ceil(
      (hacksPerBatch * SECURITY.HACK_INCREASE) / SECURITY.WEAKEN_DECREASE,
    );
    const growthNeeded = 1 / (1 - (hacksPerBatch * hackAmount));
    const growsForHacks = Math.ceil(ns.growthAnalyze(target, growthNeeded));
    const weakensForGrows = Math.ceil(
      (growsForHacks * SECURITY.GROW_INCREASE) / SECURITY.WEAKEN_DECREASE,
    );
    const threadsPerBatch = 
      hacksPerBatch + weakensForHacks + growsForHacks + weakensForGrows;
    const score = hacksPerBatch / threadsPerBatch;
    return [
      target,
      threadsPerBatch,
      hacksPerBatch,
      weakensForHacks,
      growsForHacks,
      weakensForGrows,
      score,
    ]
  }
}