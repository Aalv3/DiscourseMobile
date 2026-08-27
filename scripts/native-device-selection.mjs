export function eligiblePhysicalIPhones(devices) {
  return devices.filter(item => {
    const hardware = item.hardwareProperties || {};
    const connection = item.connectionProperties || {};
    const isIPhone =
      hardware.platform === 'iOS' &&
      (hardware.reality === undefined || hardware.reality === 'physical') &&
      (hardware.deviceType === undefined || hardware.deviceType === 'iPhone');

    return (
      isIPhone &&
      connection.pairingState === 'paired' &&
      connection.tunnelState !== 'unavailable'
    );
  });
}

export function selectPhysicalIPhone(devices, requestedIdentifier) {
  const eligible = eligiblePhysicalIPhones(devices);

  if (requestedIdentifier) {
    const selected = eligible.find(
      item => item.identifier === requestedIdentifier,
    );
    if (!selected) {
      throw new Error('requested physical iPhone is not available and paired');
    }
    return selected;
  }

  if (eligible.length === 0) {
    throw new Error('no available, paired physical iPhone');
  }
  if (eligible.length > 1) {
    throw new Error(
      'multiple available, paired physical iPhones; pass --device=<identifier>',
    );
  }
  return eligible[0];
}
