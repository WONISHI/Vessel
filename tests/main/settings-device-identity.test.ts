import { expect, it, vi } from 'vitest'
import type { NetworkInterfaceInfo } from 'node:os'
import { deviceDisplayName, getDeviceDisplayName } from '../../src/main/settings/device-identity'
vi.mock('node:child_process', () => ({ execFile: Object.assign(() => {}, { [Symbol.for('nodejs.util.promisify.custom')]: async () => ({stdout:'Mac16,1\n',stderr:''}) }) }))
vi.mock('node:os', () => ({ hostname: () => 'fallback-host', platform: () => 'darwin', networkInterfaces: () => ({ en0: [address('aa:bb:cc:dd:ee:ff')] }) }))
function address(mac: string, internal = false): NetworkInterfaceInfo { return { address:'192.168.1.1', netmask:'255.255.255.0',family:'IPv4',cidr:null,mac,internal } }
it('combines the model with the physical interface rather than virtual or loopback addresses', () => {
 expect(deviceDisplayName('Mac16,1', { lo0:[address('11:11:11:11:11:11',true)], docker0:[address('22:22:22:22:22:22')], en1:[address('33:33:33:33:33:33')], en0:[address('aa:bb:cc:dd:ee:ff')] })).toBe('Mac16,1 · AA:BB:CC:DD:EE:FF')
})
it('reports unavailable MAC addresses without inventing one and falls back to the hostname', () => {
 expect(deviceDisplayName('', {en0:[address('00:00:00:00:00:00')]})).toBe('fallback-host · MAC 地址不可用')
})
it('reads the macOS model to build the read-only device name', async () => {
 expect(await getDeviceDisplayName()).toBe('Mac16,1 · AA:BB:CC:DD:EE:FF')
})
