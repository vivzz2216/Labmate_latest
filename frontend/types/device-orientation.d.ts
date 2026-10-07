// Type declaration for iOS Safari experimental DeviceOrientationEvent API
interface DeviceOrientationEvent {
  // iOS only experimental API
  requestPermission?: () => Promise<PermissionState>;
}

