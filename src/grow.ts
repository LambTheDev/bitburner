import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
  ns.disableLog('grow');
  if (ns.args.length < 2) {
    ns.tprint('Usage: ./grow.js <target> <delay_ms>');
    return;
  }
  const target = ns.args[0] as string;
  const additionalMsec = ns.args[1] as number;

  await ns.grow(target, { additionalMsec });
}
