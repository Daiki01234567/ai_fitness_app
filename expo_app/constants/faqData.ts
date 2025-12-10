/**
 * FAQデータ定義
 *
 * ヘルプセンターで表示するFAQデータを定義します。
 *
 * @see docs/expo/tickets/029-help-center.md
 */

/**
 * FAQ項目
 */
export interface FAQItem {
  /** ID */
  id: string;
  /** 質問 */
  question: string;
  /** 回答 */
  answer: string;
}

/**
 * FAQカテゴリ
 */
export interface FAQCategory {
  /** ID */
  id: string;
  /** タイトル */
  title: string;
  /** アイコン名 */
  icon: string;
  /** FAQ項目 */
  items: FAQItem[];
}

/**
 * FAQデータ
 */
export const FAQ_DATA: FAQCategory[] = [
  {
    id: "account",
    title: "アカウントについて",
    icon: "account-circle",
    items: [
      {
        id: "forgot-password",
        question: "パスワードを忘れた場合はどうすればいいですか？",
        answer:
          "ログイン画面の「パスワードをお忘れですか？」をタップしてください。登録したメールアドレスにパスワードリセットのリンクが送信されます。リンクをクリックして新しいパスワードを設定してください。",
      },
      {
        id: "login-issue",
        question: "ログインできない場合はどうすればいいですか？",
        answer:
          "メールアドレスとパスワードが正しいか確認してください。それでもログインできない場合は、パスワードをリセットするか、お問い合わせフォームからご連絡ください。",
      },
      {
        id: "delete-account",
        question: "アカウントを削除したいです",
        answer:
          "設定画面から「アカウント削除」をタップしてください。削除をリクエストすると、30日間の猶予期間の後にアカウントとすべてのデータが完全に削除されます。猶予期間中はいつでもキャンセルできます。",
      },
      {
        id: "change-email",
        question: "メールアドレスを変更したいです",
        answer:
          "プロフィール画面からメールアドレスを変更できます。変更後は新しいメールアドレスに確認メールが送信されます。",
      },
    ],
  },
  {
    id: "training",
    title: "トレーニングについて",
    icon: "dumbbell",
    items: [
      {
        id: "camera-setup",
        question: "カメラの設置方法を教えてください",
        answer:
          "トレーニングを始める前に、カメラ設定画面で全身が映るように調整してください。カメラから1.5〜2.5m離れ、明るい場所で背景がシンプルな環境が推奨されます。種目によって横向き・正面の推奨があるので、画面の指示に従ってください。",
      },
      {
        id: "voice-feedback",
        question: "音声フィードバックが聞こえません",
        answer:
          "デバイスの音量を確認し、マナーモードがオフになっていることを確認してください。設定画面から音声フィードバックがONになっていることも確認してください。",
      },
      {
        id: "score-calculation",
        question: "スコアはどのように計算されますか？",
        answer:
          "スコアはAIがフォームを分析して算出した参考値です。関節の角度、体の姿勢、動作の滑らかさなどを総合的に評価しています。あくまで参考情報としてご利用ください。",
      },
      {
        id: "exercise-types",
        question: "どんな種目ができますか？",
        answer:
          "現在は5種目に対応しています：スクワット、プッシュアップ、アームカール、サイドレイズ、ショルダープレス。今後も種目を追加していく予定です。",
      },
      {
        id: "rep-count",
        question: "レップ数がカウントされません",
        answer:
          "カメラに全身が映っているか確認してください。また、動作が速すぎたり遅すぎたりすると正しくカウントされない場合があります。推奨される動作スピードで行ってみてください。",
      },
    ],
  },
  {
    id: "subscription",
    title: "課金・サブスクリプションについて",
    icon: "credit-card",
    items: [
      {
        id: "free-plan",
        question: "無料プランでは何ができますか？",
        answer:
          "無料プランでは1日3回までトレーニングができます。5種目すべてにアクセスできますが、回数制限があります。",
      },
      {
        id: "premium-plan",
        question: "プレミアムプランの特典は何ですか？",
        answer:
          "月額500円で無制限のトレーニング、広告なし、履歴の無制限保存などの特典があります。最初の1週間は無料でお試しいただけます。",
      },
      {
        id: "cancel-subscription",
        question: "サブスクリプションをキャンセルしたいです",
        answer:
          "設定画面の「サブスクリプション管理」からキャンセルできます。キャンセル後も次回更新日までは引き続きプレミアム機能をご利用いただけます。",
      },
      {
        id: "payment-method",
        question: "どのような支払い方法が使えますか？",
        answer:
          "クレジットカード（Visa、Mastercard、American Express、JCB）でお支払いいただけます。支払い情報は安全に処理され、アプリには保存されません。",
      },
      {
        id: "refund",
        question: "返金はできますか？",
        answer:
          "サブスクリプションの返金については、App Store（iOS）またはGoogle Play（Android）の返金ポリシーに従います。詳しくは各プラットフォームのサポートにお問い合わせください。",
      },
    ],
  },
  {
    id: "privacy",
    title: "プライバシーについて",
    icon: "shield-lock",
    items: [
      {
        id: "camera-data",
        question: "カメラの映像はどうなりますか？",
        answer:
          "カメラの映像はデバイス内でのみ処理され、外部に送信されることはありません。プライバシーを最優先に設計しています。",
      },
      {
        id: "data-download",
        question: "自分のデータをダウンロードできますか？",
        answer:
          "はい。プロフィール画面の「データ管理」から、ご自身のトレーニング記録などをダウンロードできます。",
      },
      {
        id: "data-deletion",
        question: "データを完全に削除してほしいです",
        answer:
          "アカウント削除をリクエストすると、30日後にすべてのデータが完全に削除されます。個別のデータ削除については、お問い合わせフォームからご連絡ください。",
      },
      {
        id: "data-sharing",
        question: "データは第三者と共有されますか？",
        answer:
          "匿名化された統計データのみサービス改善のために使用することがあります。個人を特定できる情報が第三者と共有されることはありません。詳しくはプライバシーポリシーをご確認ください。",
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "トラブルシューティング",
    icon: "wrench",
    items: [
      {
        id: "app-crash",
        question: "アプリがクラッシュします",
        answer:
          "アプリを最新バージョンに更新してください。それでも問題が続く場合は、アプリを再インストールするか、お問い合わせフォームからご連絡ください。",
      },
      {
        id: "camera-permission",
        question: "カメラが起動しません",
        answer:
          "設定アプリからカメラの許可が有効になっているか確認してください。許可されていない場合は、設定から許可してください。",
      },
      {
        id: "notification-not-received",
        question: "通知が届きません",
        answer:
          "設定アプリから通知の許可が有効になっているか確認してください。また、アプリ内の通知設定がオンになっているかも確認してください。",
      },
      {
        id: "slow-performance",
        question: "アプリの動作が遅いです",
        answer:
          "バックグラウンドで動作している他のアプリを終了してみてください。また、デバイスの空き容量を確認し、十分な空き容量を確保してください。",
      },
    ],
  },
];

/**
 * FAQを検索
 *
 * @param query - 検索クエリ
 * @returns フィルタリングされたFAQカテゴリ
 */
export function searchFAQ(query: string): FAQCategory[] {
  if (!query.trim()) {
    return FAQ_DATA;
  }

  const lowerQuery = query.toLowerCase();

  return FAQ_DATA.map((category) => ({
    ...category,
    items: category.items.filter(
      (item) =>
        item.question.toLowerCase().includes(lowerQuery) ||
        item.answer.toLowerCase().includes(lowerQuery)
    ),
  })).filter((category) => category.items.length > 0);
}

/**
 * FAQ検索結果の件数を取得
 *
 * @param query - 検索クエリ
 * @returns 検索結果の件数
 */
export function getFAQSearchCount(query: string): number {
  if (!query.trim()) {
    return FAQ_DATA.reduce((sum, category) => sum + category.items.length, 0);
  }

  const lowerQuery = query.toLowerCase();
  let count = 0;

  FAQ_DATA.forEach((category) => {
    category.items.forEach((item) => {
      if (
        item.question.toLowerCase().includes(lowerQuery) ||
        item.answer.toLowerCase().includes(lowerQuery)
      ) {
        count++;
      }
    });
  });

  return count;
}
