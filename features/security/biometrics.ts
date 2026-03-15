import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";

export type BiometricCapability = {
  supported: boolean;
  enrolled: boolean;
  label: string;
  reason: string | null;
};

function biometricLabel(
  types: LocalAuthentication.AuthenticationType[],
): string {
  if (
    types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
  ) {
    return Platform.OS === "ios" ? "Face ID" : "Face unlock";
  }

  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return Platform.OS === "ios" ? "Touch ID" : "Fingerprint";
  }

  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return "Iris";
  }

  return "Biometrics";
}

export async function getBiometricCapability(): Promise<BiometricCapability> {
  if (Platform.OS === "web") {
    return {
      supported: false,
      enrolled: false,
      label: "Biometrics",
      reason: "Biometric unlock is available only on iOS and Android devices.",
    };
  }

  const [hasHardware, enrolled, types, enrolledLevel] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
    LocalAuthentication.getEnrolledLevelAsync(),
  ]);
  const label = biometricLabel(types);

  if (!hasHardware || types.length === 0) {
    return {
      supported: false,
      enrolled: false,
      label,
      reason: "This device does not support biometric authentication.",
    };
  }

  if (!enrolled) {
    return {
      supported: true,
      enrolled: false,
      label,
      reason: `Set up ${label} in your device settings to enable app lock.`,
    };
  }

  if (
    Platform.OS === "android" &&
    enrolledLevel < LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG
  ) {
    return {
      supported: false,
      enrolled: false,
      label,
      reason:
        "PaydayPlanner requires a stronger biometric method on Android, such as fingerprint or a secure 3D face scan.",
    };
  }

  return {
    supported: true,
    enrolled: true,
    label,
    reason: null,
  };
}

export async function promptForBiometric(
  label: string,
  reason?: string,
): Promise<LocalAuthentication.LocalAuthenticationResult> {
  return LocalAuthentication.authenticateAsync({
    promptMessage: `Unlock with ${label}`,
    promptDescription:
      reason ??
      "Protect your paycheck and bill details before showing the app.",
    promptSubtitle: "PaydayPlanner Security",
    cancelLabel: "Not now",
    disableDeviceFallback: true,
    fallbackLabel: "",
    biometricsSecurityLevel: Platform.OS === "android" ? "strong" : undefined,
  });
}
