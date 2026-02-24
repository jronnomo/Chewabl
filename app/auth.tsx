import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Mail, Lock, User, Phone, ChevronRight, Eye, EyeOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import StaticColors from '../constants/colors';
import { useColors } from '../context/ThemeContext';

const Colors = StaticColors;

type Tab = 'signin' | 'signup';

export default function AuthScreen() {
  const Colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn, signUp } = useAuth();

  const [tab, setTab] = useState<Tab>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);

  const handleSubmit = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Email and password are required.');
      return;
    }
    if (tab === 'signup' && !name.trim()) {
      Alert.alert('Missing fields', 'Please enter your name.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      if (tab === 'signin') {
        await signIn(email.trim(), password);
      } else {
        await signUp(name.trim(), email.trim(), password, phone.trim() || undefined);
      }
      router.replace('/(tabs)' as never);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      if (message.includes('Cannot connect to server')) {
        Alert.alert(
          'Server Unavailable',
          'The server is not reachable right now. You can continue as a guest to explore the app — your preferences will be saved locally.',
          [
            { text: 'Try Again', style: 'cancel' },
            { text: 'Continue as Guest', onPress: () => router.replace('/(tabs)' as never) },
          ]
        );
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setLoading(false);
    }
  }, [tab, name, email, password, phone, signIn, signUp, router]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: Colors.background }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoWrap}>
            <View style={[styles.logoCircle, { backgroundColor: Colors.primaryLight }]}>
              <Text style={styles.logoEmoji}>🍽️</Text>
            </View>
            <Text style={[styles.appName, { color: Colors.text }]}>Chewabl</Text>
            <Text style={[styles.tagline, { color: Colors.textSecondary }]}>Find your next great meal</Text>
          </View>

          <View style={[styles.tabRow, { backgroundColor: Colors.card }]}>
            <Pressable
              style={[styles.tab, tab === 'signin' && styles.tabActive]}
              onPress={() => { setTab('signin'); setName(''); setEmail(''); setPassword(''); setPhone(''); setShowPassword(false); }}
            >
              <Text style={[styles.tabText, { color: Colors.textSecondary }, tab === 'signin' && styles.tabTextActive]}>
                Sign In
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, tab === 'signup' && styles.tabActive]}
              onPress={() => { setTab('signup'); setName(''); setEmail(''); setPassword(''); setPhone(''); setShowPassword(false); }}
            >
              <Text style={[styles.tabText, { color: Colors.textSecondary }, tab === 'signup' && styles.tabTextActive]}>
                Create Account
              </Text>
            </Pressable>
          </View>

          <View style={styles.form}>
            {tab === 'signup' && (
              <View style={[styles.inputWrap, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
                <User size={18} color={Colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: Colors.text }]}
                  placeholder="Full name"
                  placeholderTextColor={Colors.textTertiary}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
              </View>
            )}

            <View style={[styles.inputWrap, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
              <Mail size={18} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                ref={emailRef}
                style={[styles.input, { color: Colors.text }]}
                placeholder="Email address"
                placeholderTextColor={Colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>

            <View style={[styles.inputWrap, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
              <Lock size={18} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                ref={passwordRef}
                style={[styles.input, { color: Colors.text }]}
                placeholder="Password"
                placeholderTextColor={Colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType={tab === 'signup' ? 'next' : 'done'}
                onSubmitEditing={tab === 'signin' ? handleSubmit : () => phoneRef.current?.focus()}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8} accessibilityLabel="Toggle password visibility" accessibilityRole="button">
                {showPassword ? (
                  <EyeOff size={18} color={Colors.textSecondary} />
                ) : (
                  <Eye size={18} color={Colors.textSecondary} />
                )}
              </Pressable>
            </View>

            {tab === 'signup' && (
              <View style={[styles.inputWrap, { backgroundColor: Colors.card, borderColor: Colors.border }]}>
                <Phone size={18} color={Colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  ref={phoneRef}
                  style={[styles.input, { color: Colors.text }]}
                  placeholder="Phone number (optional)"
                  placeholderTextColor={Colors.textTertiary}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
              </View>
            )}

            <Pressable
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              accessibilityLabel={tab === 'signin' ? 'Sign In Button' : 'Create Account Button'}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={styles.submitBtnText}>
                    {tab === 'signin' ? 'Sign In' : 'Create Account'}
                  </Text>
                  <ChevronRight size={18} color="#FFF" />
                </>
              )}
            </Pressable>
          </View>

          <Pressable
            style={styles.skipBtn}
            onPress={() => router.replace('/(tabs)' as never)}
          >
            <Text style={[styles.skipBtnText, { color: Colors.textSecondary }]}>
              Continue without an account
            </Text>
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    flexGrow: 1,
    justifyContent: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoEmoji: {
    fontSize: 36,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: Colors.text,
  },
  tagline: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 4,
    marginBottom: 28,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: '#FFF',
  },
  form: {
    gap: 14,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.text,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 28,
    gap: 6,
    marginTop: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  skipBtnText: {
    fontSize: 14,
    fontWeight: '500' as const,
    textDecorationLine: 'underline' as const,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFF',
  },
});
