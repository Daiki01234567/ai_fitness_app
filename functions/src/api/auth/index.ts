/**
 * 認証 API Functions インデックス
 *
 * 認証関連の callable 関数
 *
 * @version 1.1.0
 * @date 2025-12-02
 */

// ユーザー登録
// eslint-disable-next-line camelcase
export { auth_signUp } from "./register";

// メールアドレス重複チェック
// eslint-disable-next-line camelcase
export { auth_checkEmailExists } from "./checkEmailExists";

// TODO: Implement in future tickets
// export { auth_onSignIn } from "./signIn";
