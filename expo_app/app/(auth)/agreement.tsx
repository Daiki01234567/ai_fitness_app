/**
 * Terms of Service and Privacy Policy Agreement Screen
 *
 * Users must agree to both ToS and Privacy Policy before using the app.
 * This screen:
 * - Displays full text of ToS and Privacy Policy (expandable or modal)
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
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
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

// Full Terms of Service text (v1.0)
const TERMS_OF_SERVICE_FULL = `利用規約 v1.0

AIフィットネスアプリ（仮称）利用規約

バージョン: 1.0
最終更新日: 2025年12月9日
施行日: 2025年5月1日（予定）

1. 定義

1.1 基本用語

「本サービス」: 当社が提供する「AIフィットネスアプリ（仮称）」
「当社」: 本サービスを提供する事業者
「利用者」: 本規約に同意の上、本サービスを利用するすべての個人
「アカウント」: 本サービスを利用するために登録されたユーザーアカウント

1.2 機能に関する用語

「フォーム確認補助機能」: MediaPipe Poseを用いて骨格を検出し、トレーニングフォームに関する参考情報を提供する機能。これは医学的な判定や診断を行うものではなく、薬機法に基づく医療機器でもありません。
「参考情報」: 本サービスが提供するトレーニングフォームに関する情報であり、医学的アドバイス、診断、治療、予防を目的とするものではありません。
「骨格座標データ」: MediaPipe Poseによって検出された身体の関節位置の座標情報。カメラ映像そのものは含まれず、本サービスではカメラ映像をサーバーに送信しません。

2. サービスの概要

2.1 サービスの目的

本サービスは、トレーニングフォームの確認を補助するための参考情報を提供することを目的とします。

重要: 本サービスは以下のものではありません：
- 医療機器（薬機法に基づく承認を受けていません）
- 医学的アドバイスを提供するサービス
- 診断、治療、予防を目的とするサービス

2.2 提供する機能

2.2.1 フォーム確認補助機能

1. 骨格検出: MediaPipe Poseを使用して、カメラに映った利用者の骨格を検出します
2. 参考情報の提供: 検出された骨格データに基づき、トレーニングフォームに関する参考情報を提供します
3. 参考スコアの算出: トレーニングフォームに関する参考スコアを算出します（0-100点）

2.2.2 対象種目

1. スクワット
2. プッシュアップ
3. アームカール
4. サイドレイズ
5. ショルダープレス

2.2.3 トレーニング記録機能

1. 履歴管理: トレーニングの実施日時、種目、回数、スコア等を記録
2. 統計表示: トレーニング履歴をグラフで可視化

2.3 利用上の注意事項

利用者は、本サービスを利用する前に、以下の事項を理解し、同意するものとします：

1. 医療機器でないこと: 本サービスは、薬機法に基づく医療機器ではありません
2. 参考情報の性質: 本サービスが提供する情報は、参考情報であり、医学的アドバイスではありません
3. 正確性の限界: 参考情報は、必ずしも正確、完全、最新であることを保証するものではありません
4. 利用者の責任: トレーニングの実施、継続、中止等の最終判断は、利用者自身が行います
5. 健康リスク: 不適切なトレーニングは、怪我や健康被害をもたらす可能性があります

3. 利用資格

3.1 年齢制限

1. 本サービスは、満13歳以上の方が利用できます
2. 未成年者（満20歳未満）が利用する場合、親権者または法定代理人の同意が必要です

3.2 技術的要件

対応OS: iOS 15.0以上、Android 8.0以上
インターネット接続: Wi-FiまたはLTE/4G/5G接続
カメラ: 前面または背面カメラ（720p以上）
ストレージ: 100MB以上の空き容量

4. アカウント登録

4.1 登録方法

本サービスを利用するには、アカウント登録が必要です。利用者は、以下の方法でアカウントを登録できます：

- メールアドレス/パスワード認証
- Googleアカウントによる認証（OAuth 2.0）
- Appleアカウントによる認証（Sign in with Apple）

4.2 登録情報

4.2.1 必須情報

メールアドレス: ユーザー識別、連絡用
ニックネーム: 1文字以上50文字以内
生年月日: 年齢制限の確認のため
利用規約への同意: 本規約への同意が必須
プライバシーポリシーへの同意: プライバシーポリシーへの同意が必須

5. 利用料金

5.1 料金プラン

本サービスは、以下の料金プランを提供します：

5.1.1 無料プラン
料金: 無料
機能: 基本的なフォーム確認補助機能、トレーニング記録機能

5.1.2 有料プラン
料金: 月額500円（税込）
利用制限: 無制限
無料トライアル: 初回登録時に7日間の無料トライアル

5.2 支払い方法

iOS: Apple App Store（App内課金）
Android: Google Play（アプリ内課金）
Web: Stripe（Web決済）

重要: 当社は決済情報を一切取得しません。すべての決済処理は、Apple/Google/Stripeが行います。

5.3 返金

原則として、既に支払われた料金の返金は行いません。ただし、以下の場合には、返金を検討することがあります：

- 当社のシステム不具合により、サービスを利用できなかった場合（24時間以上の連続した障害）
- 誤課金が発生した場合（当社の責任による二重課金等）

6. 利用条件

6.1 利用者の責任

1. 自己責任の原則: 利用者は、本サービスを自己の責任において利用するものとします
2. 健康管理: 利用者は、自身の健康状態を把握し、無理のない範囲でトレーニングを行うものとします
3. 安全確保: 利用者は、安全な環境でトレーニングを行い、怪我等を防ぐための適切な措置を講じるものとします
4. 医療専門家への相談: 健康上の不安がある場合は、本サービスの利用前に医療専門家に相談するものとします

7. 禁止事項

利用者は、本サービスの利用にあたり、以下の行為を行ってはなりません。

7.1 法令違反

1. 日本国または利用者が所在する国・地域の法令に違反する行為
2. 犯罪行為または犯罪に結びつく行為
3. 公序良俗に反する行為

7.2 不正アクセス

1. 本サービスのサーバーやネットワークに不正にアクセスする行為
2. 本サービスの運営を妨害する行為
3. 本サービスの脆弱性を探索または悪用する行為

8. 免責事項

8.1 医療機器でないことの免責

1. 本サービスは医療機器ではありません。薬機法に基づく医療機器の承認を受けていません
2. 本サービスは、診断、治療、予防を目的とするものではありません
3. 本サービスの利用により、怪我、疾病、その他の健康上の問題が発生しても、当社は一切の責任を負いません

8.2 参考情報の免責

1. 本サービスが提供する参考情報は、必ずしも正確、完全、最新であることを保証するものではありません
2. 参考情報に基づいてトレーニングを行った結果、怪我、疾病、その他の損害が発生しても、当社は一切の責任を負いません

9. アカウントの停止・削除

9.1 利用者によるアカウント削除

9.1.1 削除方法

1. 利用者は、いつでもアカウントを削除することができます
2. アカウント削除は、アプリ内の「設定」→「アカウント削除」から行います
3. アカウント削除リクエスト後、30日間の猶予期間が設定されます

9.1.2 削除猶予期間中の制限

アカウント削除リクエスト後、30日間の猶予期間中は、以下の制限が適用されます：

新規データの作成: 禁止
既存データの変更: 禁止
データの読み取り: 許可（データエクスポートが可能）

9.1.3 削除されるデータ

アカウント削除により、以下のデータが完全に削除されます：

- アカウント情報
- プロフィール情報
- トレーニング履歴
- 骨格座標データ
- 仮名化データ（BigQuery）

重要: 削除されたデータは、完全に復元できません。削除前に必要なデータをエクスポートしてください。

10. 個人情報の取り扱い

個人情報の取り扱いについては、当社が別途定める「プライバシーポリシー v1.0」に従います。

11. 準拠法・管轄裁判所

11.1 準拠法

本規約は、日本法に準拠し、日本法に従って解釈されるものとします。

11.2 管轄裁判所

本規約または本サービスに関連して生じた紛争については、東京地方裁判所を第一審の専属的合意管轄裁判所とします。

お問い合わせ

本規約に関するお問い合わせは、以下までご連絡ください。

メールアドレス: support@example.com
営業時間: 平日10:00〜18:00（日本時間）

変更履歴

バージョン v1.0 - 2025年12月9日: 初版作成

制定日: 2025年5月1日（予定）
最終更新日: 2025年12月9日`;

// Full Privacy Policy text (v1.0)
const PRIVACY_POLICY_FULL = `プライバシーポリシー v1.0

AIフィットネスアプリ（仮称）プライバシーポリシー

バージョン: 1.0
最終更新日: 2025年12月9日
施行日: 2025年5月1日（予定）

1. プライバシーポリシーの概要

1.1 目的

本プライバシーポリシーは、当社が提供するAIフィットネスアプリ（以下「本サービス」）における、利用者の個人情報の取り扱いについて定めるものです。

1.2 適用範囲

本プライバシーポリシーは、本サービスのすべての利用者に適用されます。

1.3 準拠法令

本プライバシーポリシーは、以下の法令に準拠します：

- GDPR（EU一般データ保護規則）
- 個人情報保護法（日本）
- 電気通信事業法（日本）

2. 収集する情報

2.1 直接収集する情報

利用者が本サービスに登録・入力する情報：

アカウント情報: メールアドレス、パスワード（必須）
プロフィール情報: ニックネーム、生年月日（必須）
身体情報: 身長、体重、性別（任意）
トレーニング記録: 種目、回数、セット数、スコア（自動）
骨格座標データ: 33個の関節位置（x,y,z,visibility）（自動）

重要: カメラ映像そのものは、サーバーに送信されません。MediaPipe Poseによる骨格検出は、デバイス上で行われます。

2.2 自動収集する情報

本サービスの利用時に自動的に収集される情報：

デバイス情報: OS種別、OSバージョン、デバイスモデル、デバイスメモリ
アプリ利用情報: アプリ起動日時、利用機能、セッション時間
パフォーマンス情報: 平均FPS、フレームドロップ数、推論時間

2.3 第三者から取得する情報

以下の認証サービスを利用した場合に取得する情報：

Google認証: メールアドレス、表示名、プロフィール画像URL
Apple認証: メールアドレス（または仮想アドレス）、表示名

3. 情報の利用目的

3.1 主な利用目的

本サービスの提供: アカウント情報、プロフィール情報、トレーニング記録
フォーム確認補助: 骨格座標データ、身体情報
サービス改善: 仮名化されたトレーニングデータ、デバイス情報
カスタマーサポート: メールアドレス、問い合わせ内容
不正利用の防止: デバイス情報、アプリ利用情報

3.2 同意に基づく利用

以下の目的での利用は、利用者の明示的な同意を得た上で行います：

- 骨格座標データの収集と分析
- マーケティングメールの送信
- 将来のカスタムMLモデル開発のためのデータ利用

3.3 利用しない目的

以下の目的では、利用者の情報を利用しません：

- 医学的診断、治療、予防
- 第三者への販売・譲渡
- 利用者の同意のない目的外利用

4. 情報の第三者提供

4.1 第三者サービスの利用

本サービスは、以下の第三者サービスを利用しています：

Firebase Authentication（Google LLC）: 認証
Cloud Firestore（Google LLC）: データ保存
BigQuery（Google LLC）: データ分析
Stripe（Stripe Inc.）: 決済処理
Apple App Store（Apple Inc.）: App内課金（iOS）
Google Play（Google LLC）: アプリ内課金（Android）

4.2 データ移転の保護措置

EU標準契約条項（SCCs）:
- Googleのデータ処理規約（Data Processing Amendment）
- Stripeのデータ処理契約（Data Processing Agreement）

データセンターの所在地:
- 主要データ：日本（asia-northeast1）
- バックアップ：米国（EU SCCsによる保護）

5. データの保存期間

5.1 保存期間一覧

ユーザープロフィール: 最終ログインから3年（自動削除）
トレーニングセッション: 作成から3年（自動削除）
仮名化データ（BigQuery）: 2年（パーティショニング自動削除）
同意履歴: 削除不可（GDPR監査証跡として保存）
削除リクエスト: 完了後1年（自動削除）

5.2 アカウント削除

利用者がアカウント削除をリクエストした場合：

1. 30日間の猶予期間: 削除をキャンセル可能
2. 完全削除: 30日後にすべてのデータを完全削除
3. 復元不可: 削除後のデータ復元はできません

6. データのセキュリティ

6.1 技術的セキュリティ対策

通信暗号化: TLS 1.3による全通信の暗号化
保存時暗号化: Google管理鍵によるFirestore/BigQueryの暗号化
パスワード暗号化: bcryptによるハッシュ化
アクセス制御: Firestoreセキュリティルールによるフィールドレベル制御

6.2 組織的セキュリティ対策

- アクセス権限の最小化
- 定期的なセキュリティ監査
- 従業員への教育訓練
- インシデント対応計画

7. 利用者の権利

7.1 GDPR準拠の権利

利用者は、以下の権利を有します：

アクセス権（第15条）: プロフィール画面で閲覧可能（即時）
訂正権（第16条）: プロフィール画面で編集可能（即時）
削除権（第17条）: アカウント削除機能（30日以内に完全削除）
ポータビリティ権（第20条）: JSONエクスポート機能（1ヶ月以内）
処理の制限権（第18条）: privacy@example.comへ連絡（1ヶ月以内）
異議権（第21条）: privacy@example.comへ連絡（1ヶ月以内）
同意撤回権（第7条3項）: アプリ内設定で撤回可能（即時）

7.2 権利行使の方法

データエクスポート:
1. アプリ内「設定」→「データエクスポート」を選択
2. JSON形式でダウンロード

アカウント削除:
1. アプリ内「設定」→「アカウント削除」を選択
2. 30日間の猶予期間後に完全削除

その他の権利行使:
- メール: privacy@example.com
- 対応期限: 1ヶ月以内

8. Cookie等の利用

8.1 本サービスにおけるCookieの利用

本サービス（モバイルアプリ）では、Webブラウザで使用されるCookieは利用しません。

8.2 類似技術の利用

以下の技術を利用しています：

Firebase Authentication Token: ログイン状態の維持
AsyncStorage: アプリ設定の保存

9. プライバシーポリシーの変更

9.1 変更の通知

1. プライバシーポリシーを変更する場合、変更の30日前までに利用者に通知します
2. 通知方法：メール、アプリ内通知、Webサイトでの告知

9.2 変更への同意

変更後のプライバシーポリシーが施行された後、本サービスを継続して利用した場合、変更後のポリシーに同意したものとみなされます。

10. お問い合わせ

10.1 一般的なお問い合わせ

メールアドレス: support@example.com
営業時間: 平日10:00〜18:00（日本時間）

10.2 データ保護責任者（DPO）

役職: データ保護責任者（Data Protection Officer）
メールアドレス: dpo@example.com
対応言語: 日本語、英語

10.3 監督機関への苦情申立

利用者は、以下の監督機関に苦情を申し立てる権利を有します：

日本: 個人情報保護委員会（https://www.ppc.go.jp/）
EU: 各加盟国のデータ保護機関

付録: 用語集

技術用語

MediaPipe Pose: Googleが開発したオープンソースの骨格検出ライブラリ
Firebase: Googleが提供するモバイル/Webアプリケーション開発プラットフォーム
BigQuery: Googleが提供するクラウドデータウェアハウス
仮名化: 個人を直接特定できない形式への変換

法的用語

GDPR: EU一般データ保護規則。EU域内の個人データの保護に関する規則
データ主体: 個人データによって識別される個人
データ管理者: 個人データの処理の目的および方法を決定する者

変更履歴

バージョン v1.0 - 2025年12月9日: 初版作成

制定日: 2025年5月1日（予定）
最終更新日: 2025年12月9日`;

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

// Document type for modal display
type DocumentType = "tos" | "pp" | null;

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

  // Modal state for full document display
  const [modalVisible, setModalVisible] = useState(false);
  const [activeDocument, setActiveDocument] = useState<DocumentType>(null);

  // Track whether user has viewed full documents (required before consent)
  const [hasViewedTos, setHasViewedTos] = useState(false);
  const [hasViewedPp, setHasViewedPp] = useState(false);

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

      // Check if user document already exists
      const userSnapshot = await getDoc(userRef);
      const userExists = userSnapshot.exists();

      // Current timestamp for consistency
      const now = serverTimestamp();

      if (userExists) {
        // Update existing document - only update consent fields and profile
        const updateData: Record<string, unknown> = {
          tosAccepted: true,
          ppAccepted: true,
          tosAcceptedAt: now,
          ppAcceptedAt: now,
          tosVersion: "1.0",
          ppVersion: "1.0",
          updatedAt: now,
        };

        // Add body info if available (only non-consent fields)
        if (bodyInfo) {
          if (bodyInfo.dateOfBirth) {
            updateData.dateOfBirth = new Date(bodyInfo.dateOfBirth);
          }
          if (bodyInfo.gender) {
            updateData.gender = bodyInfo.gender;
          }
          if (bodyInfo.height !== null) {
            updateData.height = bodyInfo.height;
          }
          if (bodyInfo.weight !== null) {
            updateData.weight = bodyInfo.weight;
          }
        }

        await updateDoc(userRef, updateData);
      } else {
        // Create new document with all required fields
        const createData: Record<string, unknown> = {
          // Required fields for Firestore security rules validation
          email: user.email || "",
          tosAccepted: true,
          ppAccepted: true,
          tosAcceptedAt: now,
          ppAcceptedAt: now,
          tosVersion: "1.0",
          ppVersion: "1.0",
          createdAt: now,
          updatedAt: now,
          // User info
          displayName: user.displayName || "",
          // GDPR compliance fields
          deletionScheduled: false,
          forceLogout: false,
        };

        // Add body info if available
        if (bodyInfo) {
          if (bodyInfo.dateOfBirth) {
            createData.dateOfBirth = new Date(bodyInfo.dateOfBirth);
          }
          if (bodyInfo.gender) {
            createData.gender = bodyInfo.gender;
          }
          if (bodyInfo.height !== null) {
            createData.height = bodyInfo.height;
          }
          if (bodyInfo.weight !== null) {
            createData.weight = bodyInfo.weight;
          }
        }

        await setDoc(userRef, createData);
      }

      console.log("User agreement saved successfully");

      // Navigate to home screen
      router.replace("/(app)/(tabs)");
    } catch (err) {
      console.error("Error saving agreement:", err);
      // Show more specific error message
      if (err instanceof Error) {
        if (err.message.includes("permission-denied")) {
          setError("アクセス権限エラーが発生しました。再度ログインしてください。");
        } else if (err.message.includes("network")) {
          setError("ネットワークエラーが発生しました。接続を確認してください。");
        } else {
          setError(`保存中にエラーが発生しました: ${err.message}`);
        }
      } else {
        setError("保存中にエラーが発生しました。もう一度お試しください。");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle decline - logout and return to login screen
  // Web uses window.confirm, Native uses Alert.alert
  const handleDecline = () => {
    const message =
      "利用規約とプライバシーポリシーに同意いただけない場合、本サービスをご利用いただけません。ログアウトしてログイン画面に戻ります。";

    if (Platform.OS === "web") {
      // Web: Use window.confirm for cross-browser compatibility
      const confirmed = window.confirm(`同意しない場合\n\n${message}`);
      if (confirmed) {
        performLogout();
      }
    } else {
      // Native: Use Alert.alert
      Alert.alert("同意しない場合", message, [
        {
          text: "キャンセル",
          style: "cancel",
        },
        {
          text: "ログアウト",
          style: "destructive",
          onPress: performLogout,
        },
      ]);
    }
  };

  // Perform logout action
  const performLogout = async () => {
    try {
      await signOut();
      router.replace("/(auth)/login");
    } catch (err) {
      console.error("Error signing out:", err);
      setError("ログアウト中にエラーが発生しました。");
    }
  };

  // Open full document in modal
  const openDocument = (type: "tos" | "pp") => {
    setActiveDocument(type);
    setModalVisible(true);
  };

  // Close document modal and mark as viewed
  const closeDocument = () => {
    // Mark the document as viewed when closing
    if (activeDocument === "tos") {
      setHasViewedTos(true);
    } else if (activeDocument === "pp") {
      setHasViewedPp(true);
    }
    setModalVisible(false);
    setActiveDocument(null);
  };

  // Get document content based on type
  const getDocumentContent = () => {
    if (activeDocument === "tos") {
      return TERMS_OF_SERVICE_FULL;
    } else if (activeDocument === "pp") {
      return PRIVACY_POLICY_FULL;
    }
    return "";
  };

  // Get document title based on type
  const getDocumentTitle = () => {
    if (activeDocument === "tos") {
      return "利用規約";
    } else if (activeDocument === "pp") {
      return "プライバシーポリシー";
    }
    return "";
  };

  // Render checkbox item with view requirement
  const renderCheckbox = (
    label: string,
    checked: boolean,
    onToggle: () => void,
    onViewFull: () => void,
    hasViewed: boolean
  ) => {
    const isDisabled = isLoading || !hasViewed;

    return (
      <View style={styles.checkboxContainer}>
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={onToggle}
          disabled={isDisabled}
        >
          <View style={[
            styles.checkbox,
            checked && styles.checkboxChecked,
            isDisabled && styles.checkboxDisabled,
          ]}>
            {checked && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
          <Text style={[
            styles.checkboxLabel,
            isDisabled && styles.checkboxLabelDisabled,
          ]}>
            {label}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onViewFull}>
          <Text style={[
            styles.viewFullText,
            hasViewed && styles.viewFullTextViewed,
          ]}>
            {hasViewed ? "✓ 確認済み" : "全文を見る（必須）"}
          </Text>
        </TouchableOpacity>
        {!hasViewed && (
          <Text style={styles.viewRequiredHint}>
            ※ チェックするには全文を確認してください
          </Text>
        )}
      </View>
    );
  };

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

  // Render document modal
  const renderDocumentModal = () => (
    <Modal
      visible={modalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={closeDocument}
    >
      <SafeAreaView style={styles.modalSafeArea}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{getDocumentTitle()}</Text>
          <TouchableOpacity onPress={closeDocument} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#333" />
          </TouchableOpacity>
        </View>
        <ScrollView
          style={styles.modalScrollView}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.documentText}>{getDocumentContent()}</Text>
        </ScrollView>
        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={closeDocument}
          >
            <Text style={styles.modalCloseButtonText}>閉じる</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
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
            () => openDocument("tos"),
            hasViewedTos
          )}

          {renderCheckbox(
            "プライバシーポリシーに同意します",
            ppAccepted,
            () => setPpAccepted(!ppAccepted),
            () => openDocument("pp"),
            hasViewedPp
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
            <Text style={styles.declineButtonText}>同意しない</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Document Modal */}
      {renderDocumentModal()}
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
  checkboxDisabled: {
    backgroundColor: "#f5f5f5",
    borderColor: "#ccc",
  },
  checkboxLabel: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  checkboxLabelDisabled: {
    color: "#999",
  },
  viewFullText: {
    fontSize: 14,
    color: "#2196F3",
    marginLeft: 36,
    marginTop: 4,
    fontWeight: "500",
  },
  viewFullTextViewed: {
    color: "#4CAF50",
  },
  viewRequiredHint: {
    fontSize: 12,
    color: "#ff9800",
    marginLeft: 36,
    marginTop: 2,
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
  // Modal styles
  modalSafeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  closeButton: {
    padding: 4,
  },
  modalScrollView: {
    flex: 1,
  },
  modalContent: {
    padding: 16,
    paddingBottom: 32,
  },
  documentText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 22,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  modalCloseButton: {
    height: 48,
    backgroundColor: "#4CAF50",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
