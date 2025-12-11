/**
 * Terms of Service and Privacy Policy Agreement Screen
 *
 * Users must agree to both ToS and Privacy Policy before using the app.
 * This screen:
 * - Displays summary of ToS and Privacy Policy
 * - Requires explicit consent via checkboxes
 * - Updates Firestore user document with consent status
 * - Navigates to home screen upon agreement
 *
 * @see docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md
 * @see docs/common/specs/09_利用規約_v1_0.md
 * @see docs/common/specs/10_プライバシーポリシー_v1_0.md
 */

import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/hooks";
import { signOut } from "@/lib/auth";

// Key points from Terms of Service
const TOS_KEY_POINTS = [
  "本サービスは医療機器ではありません",
  "フォーム確認補助として参考情報を提供します",
  "最終的な判断はご自身の責任で行ってください",
  "13歳以上の方がご利用いただけます",
];

// Key points from Privacy Policy
const PP_KEY_POINTS = [
  "カメラ映像はデバイス内でのみ処理されます",
  "骨格座標データのみをサーバーに送信します",
  "データは適切に保護・管理されます",
  "データ削除をご希望の場合は30日以内に処理します",
];

// Body info from signup-step2
interface BodyInfo {
  dateOfBirth: string;
  gender: string | null;
  height: number | null;
  weight: number | null;
}

export default function AgreementScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ bodyInfo?: string }>();

  // Parse body info from params
  const bodyInfo: BodyInfo | null = params.bodyInfo
    ? JSON.parse(params.bodyInfo)
    : null;

  // Consent state
  const [tosAccepted, setTosAccepted] = useState(false);
  const [ppAccepted, setPpAccepted] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Both checkboxes must be checked
  const canProceed = tosAccepted && ppAccepted;

  // Handle agreement and save to Firestore
  const handleAgree = async () => {
    if (!canProceed) {
      setError("利用規約とプライバシーポリシーの両方に同意してください");
      return;
    }

    if (!user) {
      setError("ログイン情報が取得できません。再度ログインしてください。");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const db = getFirebaseDb();
      const userRef = doc(db, "users", user.uid);

      // Prepare user document data
      const userData: Record<string, unknown> = {
        // Consent fields
        tosAccepted: true,
        ppAccepted: true,
        tosAcceptedAt: serverTimestamp(),
        ppAcceptedAt: serverTimestamp(),
        // User info
        email: user.email,
        displayName: user.displayName,
        updatedAt: serverTimestamp(),
      };

      // Add body info if available
      if (bodyInfo) {
        if (bodyInfo.dateOfBirth) {
          userData.dateOfBirth = new Date(bodyInfo.dateOfBirth);
        }
        if (bodyInfo.gender) {
          userData.gender = bodyInfo.gender;
        }
        if (bodyInfo.height !== null) {
          userData.height = bodyInfo.height;
        }
        if (bodyInfo.weight !== null) {
          userData.weight = bodyInfo.weight;
        }
      }

      // Save to Firestore (merge with existing data)
      await setDoc(userRef, userData, { merge: true });

      console.log("User agreement saved successfully");

      // Navigate to home screen
      router.replace("/(app)/(tabs)");
    } catch (err) {
      console.error("Error saving agreement:", err);
      setError("保存中にエラーが発生しました。もう一度お試しください。");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle decline - logout and return to login screen
  const handleDecline = () => {
    Alert.alert(
      "同意しない場合",
      "利用規約とプライバシーポリシーに同意いただけない場合、本サービスをご利用いただけません。ログアウトしてログイン画面に戻ります。",
      [
        {
          text: "キャンセル",
          style: "cancel",
        },
        {
          text: "ログアウト",
          style: "destructive",
          onPress: async () => {
            await signOut();
            router.replace("/(auth)/login");
          },
        },
      ]
    );
  };

  // Open full document links
  const openDocument = (type: "tos" | "pp") => {
    // These would be links to full documents
    // For now, show an alert with info
    const title = type === "tos" ? "利用規約" : "プライバシーポリシー";
    Alert.alert(
      title,
      `${title}の全文は、サービス開始後にアプリ内またはウェブサイトでご確認いただけます。`,
      [{ text: "OK" }]
    );
  };

  // Render checkbox item
  const renderCheckbox = (
    label: string,
    checked: boolean,
    onToggle: () => void,
    onViewFull: () => void
  ) => (
    <View style={styles.checkboxContainer}>
      <TouchableOpacity
        style={styles.checkboxRow}
        onPress={onToggle}
        disabled={isLoading}
      >
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          {checked && <Ionicons name="checkmark" size={16} color="#fff" />}
        </View>
        <Text style={styles.checkboxLabel}>{label}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onViewFull}>
        <Text style={styles.viewFullText}>全文を見る</Text>
      </TouchableOpacity>
    </View>
  );

  // Render key points list
  const renderKeyPoints = (title: string, points: string[]) => (
    <View style={styles.keyPointsContainer}>
      <Text style={styles.keyPointsTitle}>{title}</Text>
      {points.map((point, index) => (
        <View key={index} style={styles.keyPointItem}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color="#666"
            style={styles.keyPointIcon}
          />
          <Text style={styles.keyPointText}>{point}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.stepIndicator}>新規登録 (3/3)</Text>
          <Text style={styles.title}>利用規約と{"\n"}プライバシーポリシー</Text>
          <Text style={styles.subtitle}>
            サービスをご利用いただく前に、以下の内容をご確認ください。
          </Text>
        </View>

        {/* Terms of Service Summary */}
        {renderKeyPoints("利用規約のポイント", TOS_KEY_POINTS)}

        {/* Privacy Policy Summary */}
        {renderKeyPoints("プライバシーポリシーのポイント", PP_KEY_POINTS)}

        {/* Consent Checkboxes */}
        <View style={styles.consentSection}>
          {error && <Text style={styles.errorText}>{error}</Text>}

          {renderCheckbox(
            "利用規約に同意します",
            tosAccepted,
            () => setTosAccepted(!tosAccepted),
            () => openDocument("tos")
          )}

          {renderCheckbox(
            "プライバシーポリシーに同意します",
            ppAccepted,
            () => setPpAccepted(!ppAccepted),
            () => openDocument("pp")
          )}

          <Text style={styles.consentNote}>
            ※ 両方の同意が必要です
          </Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.agreeButton,
              !canProceed && styles.buttonDisabled,
              isLoading && styles.buttonDisabled,
            ]}
            onPress={handleAgree}
            disabled={!canProceed || isLoading}
          >
            <Text style={styles.agreeButtonText}>
              {isLoading ? "保存中..." : "同意して続ける"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.declineButton}
            onPress={handleDecline}
            disabled={isLoading}
          >
            <Text style={styles.declineButtonText}>同意しない（ログアウト）</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 24,
  },
  stepIndicator: {
    fontSize: 14,
    color: "#4CAF50",
    fontWeight: "600",
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  keyPointsContainer: {
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  keyPointsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  keyPointItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  keyPointIcon: {
    marginRight: 8,
    marginTop: 1,
  },
  keyPointText: {
    fontSize: 14,
    color: "#555",
    flex: 1,
    lineHeight: 20,
  },
  consentSection: {
    marginTop: 8,
    marginBottom: 24,
  },
  errorText: {
    color: "#dc3545",
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  checkboxContainer: {
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: "#ddd",
    borderRadius: 4,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#4CAF50",
    borderColor: "#4CAF50",
  },
  checkboxLabel: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  viewFullText: {
    fontSize: 14,
    color: "#2196F3",
    marginLeft: 36,
    marginTop: 4,
  },
  consentNote: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
    marginTop: 8,
  },
  buttonContainer: {
    marginTop: 8,
  },
  agreeButton: {
    height: 52,
    backgroundColor: "#4CAF50",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  buttonDisabled: {
    backgroundColor: "#a5d6a7",
  },
  agreeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  declineButton: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  declineButtonText: {
    color: "#dc3545",
    fontSize: 14,
  },
});
