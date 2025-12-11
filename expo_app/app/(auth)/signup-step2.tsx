/**
 * Signup Step 2: Body information input screen
 *
 * Collects user physical information after account creation:
 * - Date of birth (required, must be 13 years or older)
 * - Gender (optional)
 * - Height (optional)
 * - Weight (optional)
 * - Exercise experience (optional)
 * - Goal (optional)
 *
 * @see docs/common/specs/11_画面遷移図_ワイヤーフレーム_v1_0.md
 */

import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Gender options
type Gender = "male" | "female" | "other" | "prefer_not_to_say" | null;

interface GenderOption {
  value: Gender;
  label: string;
}

const GENDER_OPTIONS: GenderOption[] = [
  { value: "male", label: "男性" },
  { value: "female", label: "女性" },
  { value: "other", label: "その他" },
  { value: "prefer_not_to_say", label: "回答しない" },
];

// Exercise experience options (per spec)
type ExerciseExperience = "beginner" | "intermediate" | "advanced" | null;

interface ExerciseExperienceOption {
  value: ExerciseExperience;
  label: string;
}

const EXERCISE_EXPERIENCE_OPTIONS: ExerciseExperienceOption[] = [
  { value: "beginner", label: "初心者" },
  { value: "intermediate", label: "中級者" },
  { value: "advanced", label: "上級者" },
];

// Goal options (per spec)
type Goal =
  | "weight_loss"
  | "muscle_gain"
  | "health_maintenance"
  | "fitness_improvement"
  | "other"
  | null;

interface GoalOption {
  value: Goal;
  label: string;
}

const GOAL_OPTIONS: GoalOption[] = [
  { value: "weight_loss", label: "ダイエット" },
  { value: "muscle_gain", label: "筋力アップ" },
  { value: "health_maintenance", label: "健康維持" },
  { value: "fitness_improvement", label: "体力向上" },
  { value: "other", label: "その他" },
];

// Minimum age requirement (FR-001: 13 years for Japan)
const MINIMUM_AGE = 13;

// Calculate maximum date for 13 years old requirement
const getMaxDateOfBirth = (): Date => {
  const today = new Date();
  today.setFullYear(today.getFullYear() - MINIMUM_AGE);
  return today;
};

// Format date for display
const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
};

export default function SignupStep2Screen() {
  // Get nickname from previous screen
  const { nickname } = useLocalSearchParams<{ nickname?: string }>();

  // Form state
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState<Gender>(null);
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [exerciseExperience, setExerciseExperience] =
    useState<ExerciseExperience>(null);
  const [goal, setGoal] = useState<Goal>(null);

  // Validation state
  const [localError, setLocalError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Date picker change handler
  const handleDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    // Process the selection first before hiding picker
    // This ensures the value is captured on Android
    if (event.type === "set" && selectedDate) {
      setDateOfBirth(selectedDate);
      setLocalError(null);
    }

    // Then hide the picker (important: do this after processing)
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    } else if (Platform.OS === "ios" && event.type === "dismissed") {
      setShowDatePicker(false);
    }
  };

  // Confirm date selection (iOS)
  const confirmDateSelection = () => {
    setShowDatePicker(false);
  };

  // Validate age requirement
  const validateAge = (date: Date): boolean => {
    const today = new Date();
    const age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    const dayDiff = today.getDate() - date.getDate();

    // Adjust age if birthday hasn't occurred this year
    const adjustedAge =
      monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;

    return adjustedAge >= MINIMUM_AGE;
  };

  // Validate form and navigate to agreement screen
  const handleNext = async () => {
    setLocalError(null);

    // Validate date of birth (required)
    if (!dateOfBirth) {
      setLocalError("生年月日を入力してください");
      return;
    }

    // Validate age requirement
    if (!validateAge(dateOfBirth)) {
      setLocalError(`本サービスは${MINIMUM_AGE}歳以上の方がご利用いただけます`);
      return;
    }

    // Validate height range (optional but must be valid if provided)
    if (height) {
      const heightNum = parseFloat(height);
      if (isNaN(heightNum) || heightNum < 100 || heightNum > 250) {
        setLocalError("身長は100〜250cmの範囲で入力してください");
        return;
      }
    }

    // Validate weight range (optional but must be valid if provided)
    if (weight) {
      const weightNum = parseFloat(weight);
      if (isNaN(weightNum) || weightNum < 30 || weightNum > 200) {
        setLocalError("体重は30〜200kgの範囲で入力してください");
        return;
      }
    }

    setIsLoading(true);

    try {
      // Store body info in memory for agreement screen to save to Firestore
      // This data will be combined with tosAccepted/ppAccepted when saving
      const bodyInfo = {
        nickname: nickname || null,
        dateOfBirth: dateOfBirth.toISOString(),
        gender,
        height: height ? parseFloat(height) : null,
        weight: weight ? parseFloat(weight) : null,
        exerciseExperience,
        goal,
      };

      // Pass data via params to agreement screen
      router.replace({
        pathname: "/(auth)/agreement",
        params: {
          bodyInfo: JSON.stringify(bodyInfo),
        },
      });
    } catch (error) {
      console.error("Error navigating to agreement:", error);
      setLocalError("エラーが発生しました。もう一度お試しください。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.stepIndicator}>新規登録 (2/3)</Text>
            <Text style={styles.title}>身体情報を入力</Text>
            <Text style={styles.subtitle}>後から変更することもできます</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {localError && <Text style={styles.errorText}>{localError}</Text>}

            {/* Date of Birth (Required) */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>
                生年月日 <Text style={styles.required}>*必須</Text>
              </Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
                disabled={isLoading}
              >
                <Text
                  style={[
                    styles.dateButtonText,
                    !dateOfBirth && styles.placeholder,
                  ]}
                >
                  {dateOfBirth ? formatDate(dateOfBirth) : "選択してください"}
                </Text>
                <Ionicons name="calendar-outline" size={20} color="#666" />
              </TouchableOpacity>
              <Text style={styles.hint}>
                {MINIMUM_AGE}歳以上の方がご利用いただけます
              </Text>
            </View>

            {/* Date Picker */}
            {showDatePicker && (
              <View style={styles.datePickerContainer}>
                <DateTimePicker
                  value={dateOfBirth || getMaxDateOfBirth()}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={handleDateChange}
                  maximumDate={getMaxDateOfBirth()}
                  minimumDate={new Date(1900, 0, 1)}
                />
                {Platform.OS === "ios" && (
                  <TouchableOpacity
                    style={styles.dateConfirmButton}
                    onPress={confirmDateSelection}
                  >
                    <Text style={styles.dateConfirmText}>決定</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Gender (Optional) */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>性別（任意）</Text>
              <View style={styles.genderContainer}>
                {GENDER_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value || "null"}
                    style={[
                      styles.genderButton,
                      gender === option.value && styles.genderButtonActive,
                    ]}
                    onPress={() => setGender(option.value)}
                    disabled={isLoading}
                  >
                    <Text
                      style={[
                        styles.genderButtonText,
                        gender === option.value && styles.genderButtonTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Height (Optional) */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>身長（任意）</Text>
              <View style={styles.unitInputContainer}>
                <TextInput
                  style={[styles.input, styles.unitInput]}
                  value={height}
                  onChangeText={setHeight}
                  placeholder="170"
                  keyboardType="numeric"
                  editable={!isLoading}
                  maxLength={3}
                />
                <Text style={styles.unitText}>cm</Text>
              </View>
            </View>

            {/* Weight (Optional) */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>体重（任意）</Text>
              <View style={styles.unitInputContainer}>
                <TextInput
                  style={[styles.input, styles.unitInput]}
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="65"
                  keyboardType="numeric"
                  editable={!isLoading}
                  maxLength={3}
                />
                <Text style={styles.unitText}>kg</Text>
              </View>
            </View>

            {/* Exercise Experience (Optional) */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>運動経験（任意）</Text>
              <View style={styles.experienceContainer}>
                {EXERCISE_EXPERIENCE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value || "null"}
                    style={[
                      styles.experienceButton,
                      exerciseExperience === option.value &&
                        styles.experienceButtonActive,
                    ]}
                    onPress={() => setExerciseExperience(option.value)}
                    disabled={isLoading}
                  >
                    <Text
                      style={[
                        styles.experienceButtonText,
                        exerciseExperience === option.value &&
                          styles.experienceButtonTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Goal (Optional) */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>目標（任意）</Text>
              <View style={styles.goalContainer}>
                {GOAL_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value || "null"}
                    style={[
                      styles.goalOption,
                      goal === option.value && styles.goalOptionSelected,
                    ]}
                    onPress={() => setGoal(option.value)}
                    disabled={isLoading}
                  >
                    <Text
                      style={[
                        styles.goalText,
                        goal === option.value && styles.goalTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleNext}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>
                {isLoading ? "処理中..." : "次へ"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    marginBottom: 32,
  },
  stepIndicator: {
    fontSize: 14,
    color: "#4CAF50",
    fontWeight: "600",
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
  },
  form: {
    flex: 1,
  },
  errorText: {
    color: "#dc3545",
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  required: {
    color: "#dc3545",
    fontWeight: "normal",
  },
  hint: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: "#f9f9f9",
  },
  dateButton: {
    height: 48,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 16,
    backgroundColor: "#f9f9f9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateButtonText: {
    fontSize: 16,
    color: "#333",
  },
  placeholder: {
    color: "#999",
  },
  datePickerContainer: {
    marginBottom: 16,
  },
  dateConfirmButton: {
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "#4CAF50",
    borderRadius: 8,
    marginTop: 8,
    marginHorizontal: 16,
  },
  dateConfirmText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  genderContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  genderButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 20,
    marginHorizontal: 4,
    marginBottom: 8,
    backgroundColor: "#f9f9f9",
  },
  genderButtonActive: {
    borderColor: "#4CAF50",
    backgroundColor: "#E8F5E9",
  },
  genderButtonText: {
    fontSize: 14,
    color: "#666",
  },
  genderButtonTextActive: {
    color: "#4CAF50",
    fontWeight: "600",
  },
  unitInputContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  unitInput: {
    flex: 1,
  },
  unitText: {
    fontSize: 16,
    color: "#666",
    marginLeft: 12,
    width: 30,
  },
  experienceContainer: {
    flexDirection: "row",
    gap: 8,
  },
  experienceButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#f9f9f9",
  },
  experienceButtonActive: {
    backgroundColor: "#4CAF50",
    borderColor: "#4CAF50",
  },
  experienceButtonText: {
    fontSize: 14,
    color: "#666",
  },
  experienceButtonTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  goalContainer: {
    gap: 8,
  },
  goalOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#f9f9f9",
  },
  goalOptionSelected: {
    backgroundColor: "#4CAF50",
    borderColor: "#4CAF50",
  },
  goalText: {
    fontSize: 16,
    color: "#333",
  },
  goalTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },
  button: {
    height: 48,
    backgroundColor: "#4CAF50",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  buttonDisabled: {
    backgroundColor: "#a5d6a7",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
