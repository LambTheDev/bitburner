
import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
  ns.disableLog('ALL');

  const target = ns.args[0] as string;
  if (target == null) {
    ns.tprint('Usage: ./analz.js <target>');
    return;
  }
  ns.tail();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    ns.clearLog();

    const server = ns.getServer(target);
    const text = JSON.stringify(server, undefined, 2);
    ns.print(text);

    await ns.sleep(1000);
  }
}
