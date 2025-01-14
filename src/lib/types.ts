export interface ServerInfo {
  connectString: string;
  cores: number,
  hackingReq: number;
  maxMoney: number;
  maxRam: number;
  minSecurity: number;
  path: string[];
}
export type ServerInfoMap = {[key: string]: ServerInfo};
