import { EventEmitter } from 'events';
import AutoReconnectTCPClient from './AutoReconnectTCPClient';
import { toFloatStr } from '../utils/numberUtils';
import { AgentConfiguration, Position2D } from '../models/agent';

class AgentsCommService {
  static STATUS_DATA_PORT = 48101;
  static MAP_DATA_PORT = 48102;
  static CONTROL_CMD_PORT = 48201;
  static NAVIGATION_CMD_PORT = 48202;

  private eventEmitter: EventEmitter;

  constructor() {
    this.eventEmitter = new EventEmitter();
  }

  public connectToAgent(agent: AgentConfiguration) {
    if (agent.ipAddress) {
      console.log(`AgentsCommService: Starting TCP clients for ${agent.name} (${agent.ipAddress})`);
      this.startCommClient(agent.id, agent.ipAddress);
    }
  }

  public onStatusData(callback: (agentId: number, data: object) => void) {
    this.eventEmitter.on('statusData', callback);
  }

  public sendControlCmd(agentId: number, linearX: number, angularZ: number) {
    this.eventEmitter.emit('controlCmd', agentId, linearX, angularZ);
  }

  public sendNavigationCmd(agentId: number, position: Position2D) {
    this.eventEmitter.emit('navigationCmd', agentId, position);
  }

  private startCommClient(agentId: number, serverIp: string) {
    const statusDataClient = new AutoReconnectTCPClient(serverIp, AgentsCommService.STATUS_DATA_PORT);
    // const mapDataClient = new AutoReconnectTCPClient(serverIp, AgentsCommService.MAP_DATA_PORT);
    const controlCmdClient = new AutoReconnectTCPClient(serverIp, AgentsCommService.CONTROL_CMD_PORT);
    const navigationCmdClient = new AutoReconnectTCPClient(serverIp, AgentsCommService.NAVIGATION_CMD_PORT);

    statusDataClient.on('connect', () => {
      this.eventEmitter.emit('statusData', agentId, { status: 'idle' });
    });

    statusDataClient.on('close', () => {
      this.eventEmitter.emit('statusData', agentId, { status: 'offline' });
    });

    statusDataClient.on('data', (rawData) => {
      const data = JSON.parse(rawData.toString());
      this.eventEmitter.emit('statusData', agentId, {
        linearVelo: data?.cmd_vel?.linear?.x ?? 0,
        angularVelo: data?.cmd_vel?.angular?.z ?? 0,
        position: data?.odom?.position ?? null
      });
    });

    this.eventEmitter.on('controlCmd', (cmdAgentId: number, linearX: number, angularZ: number) => {
      if (agentId !== cmdAgentId) return;
      const controlData = { linear_x: linearX, angular_z: angularZ };
      controlCmdClient.write(JSON.stringify(controlData) + ';$');
    });

    this.eventEmitter.on('navigationCmd', (cmdAgentId: number, position: Position2D) => {
      if (agentId !== cmdAgentId) return;
      const [x, y] = position;
      navigationCmdClient.write(`${toFloatStr(x)},${toFloatStr(y)}\n`);
    });
  }
}

export default AgentsCommService;
