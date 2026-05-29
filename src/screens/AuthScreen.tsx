/**
 * AUTH SCREEN
 *
 * Volledig login-/registratiescherm met drie tabs:
 *   1. Inloggen          — email + wachtwoord
 *   2. Registreren       — email + wachtwoord + bevestiging (whitelist check)
 *   3. Wachtwoord vergeten — email → reset-link via Supabase
 *
 * Spiegelt exact de auth-flow van de website:
 *   - allowed_users tabel als whitelist
 *   - Supabase Auth (email/password)
 *   - Na login wordt het e-mailadres bewaard als gebruikersidentiteit
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { signIn, signUp, resetPassword } from '../services';

type AuthTab = 'login' | 'register' | 'reset';

/* Publieke juridische pagina's (gedeeld met de website). */
const PRIVACY_URL = 'https://community-web.prilleven.be/privacy.html';
const TERMS_URL = 'https://community-web.prilleven.be/voorwaarden.html';

interface AuthScreenProps {
  onAuthenticated: (email: string) => void;
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [tab, setTab] = useState<AuthTab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const switchTab = (t: AuthTab) => {
    setTab(t);
    clearMessages();
  };

  /* ---- Login ---- */
  const handleLogin = async () => {
    clearMessages();
    if (!email.trim() || !password) {
      setError('Vul je email en wachtwoord in.');
      return;
    }
    setLoading(true);
    try {
      const result = await signIn(email, password);
      onAuthenticated(result.email);
    } catch (err: any) {
      setError(
        err.message?.includes('Invalid login')
          ? 'Ongeldig emailadres of wachtwoord.'
          : err.message || 'Inloggen mislukt.'
      );
    } finally {
      setLoading(false);
    }
  };

  /* ---- Registreer ---- */
  const handleRegister = async () => {
    clearMessages();
    if (!email.trim() || !password || !passwordConfirm) {
      setError('Vul alle velden in.');
      return;
    }
    if (password.length < 6) {
      setError('Wachtwoord moet minstens 6 tekens bevatten.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('De wachtwoorden komen niet overeen.');
      return;
    }
    setLoading(true);
    try {
      const result = await signUp(email, password);
      onAuthenticated(result.email);
    } catch (err: any) {
      setError(err.message || 'Registratie mislukt.');
    } finally {
      setLoading(false);
    }
  };

  /* ---- Wachtwoord reset ---- */
  const handleReset = async () => {
    clearMessages();
    if (!email.trim()) {
      setError('Vul je emailadres in.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email);
      setSuccess(
        'Er is een e-mail verstuurd met instructies om je wachtwoord te resetten. ' +
          'Check ook je spam-map.'
      );
    } catch (err: any) {
      setError(err.message || 'Verzoek mislukt.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo / welkom */}
          <View style={styles.header}>
            <Image
              source={require('../../assets/prilleven-logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.title}>Community Pril leven</Text>
          </View>

          {/* Tab knoppen */}
          <View style={styles.tabs}>
            <Pressable
              style={[styles.tab, tab === 'login' && styles.tabActive]}
              onPress={() => switchTab('login')}
            >
              <Text
                style={[
                  styles.tabText,
                  tab === 'login' && styles.tabTextActive,
                ]}
              >
                Inloggen
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, tab === 'register' && styles.tabActive]}
              onPress={() => switchTab('register')}
            >
              <Text
                style={[
                  styles.tabText,
                  tab === 'register' && styles.tabTextActive,
                ]}
              >
                Registreren
              </Text>
            </Pressable>
          </View>

          {/* Formulier kaart */}
          <View style={styles.card}>
            {/* Error / success berichten */}
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </View>
            ) : null}
            {success ? (
              <View style={styles.successBox}>
                <Text style={styles.successText}>✅ {success}</Text>
              </View>
            ) : null}

            {/* Email (altijd) */}
            <Text style={styles.label}>Emailadres</Text>
            <TextInput
              style={styles.input}
              placeholder="jouw@email.be"
              placeholderTextColor={colors.grayLight}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!loading}
            />

            {/* Wachtwoord (login + register) */}
            {tab !== 'reset' && (
              <>
                <Text style={styles.label}>Wachtwoord</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Minstens 6 tekens"
                  placeholderTextColor={colors.grayLight}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="password"
                  editable={!loading}
                />
              </>
            )}

            {/* Wachtwoord bevestigen (register) */}
            {tab === 'register' && (
              <>
                <Text style={styles.label}>Bevestig wachtwoord</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nogmaals je wachtwoord"
                  placeholderTextColor={colors.grayLight}
                  value={passwordConfirm}
                  onChangeText={setPasswordConfirm}
                  secureTextEntry
                  autoCapitalize="none"
                  editable={!loading}
                />
              </>
            )}

            {/* Actie knop */}
            <Pressable
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={
                tab === 'login'
                  ? handleLogin
                  : tab === 'register'
                  ? handleRegister
                  : handleReset
              }
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.btnText}>
                  {tab === 'login'
                    ? 'Inloggen'
                    : tab === 'register'
                    ? 'Account aanmaken'
                    : 'Reset-link versturen'}
                </Text>
              )}
            </Pressable>

            {/* Wachtwoord vergeten link (login tab) */}
            {tab === 'login' && (
              <Pressable
                style={styles.link}
                onPress={() => switchTab('reset')}
              >
                <Text style={styles.linkText}>Wachtwoord vergeten?</Text>
              </Pressable>
            )}

            {/* Terug naar login (reset tab) */}
            {tab === 'reset' && (
              <Pressable
                style={styles.link}
                onPress={() => switchTab('login')}
              >
                <Text style={styles.linkText}>← Terug naar inloggen</Text>
              </Pressable>
            )}

            {/* Register info */}
            {tab === 'register' && (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  💡 Je kunt alleen registreren als je emailadres is
                  goedgekeurd. Neem contact op als je geen toegang hebt.
                </Text>
              </View>
            )}

            {/* Toestemming bij registratie */}
            {tab === 'register' && (
              <Text style={styles.consentText}>
                Door een account aan te maken ga je akkoord met onze{' '}
                <Text
                  style={styles.consentLink}
                  onPress={() => Linking.openURL(TERMS_URL)}
                >
                  gebruiksvoorwaarden
                </Text>{' '}
                en{' '}
                <Text
                  style={styles.consentLink}
                  onPress={() => Linking.openURL(PRIVACY_URL)}
                >
                  privacybeleid
                </Text>
                .
              </Text>
            )}
          </View>

          {/* Juridische links — altijd zichtbaar */}
          <View style={styles.legalFooter}>
            <Text
              style={styles.legalLink}
              onPress={() => Linking.openURL(PRIVACY_URL)}
            >
              Privacybeleid
            </Text>
            <Text style={styles.legalSep}>·</Text>
            <Text
              style={styles.legalLink}
              onPress={() => Linking.openURL(TERMS_URL)}
            >
              Gebruiksvoorwaarden
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoImage: {
    width: 120,
    height: 120,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.dark,
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray,
    marginTop: 2,
  },
  tabs: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    backgroundColor: colors.light,
    borderRadius: radius.md,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  tabActive: {
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray,
  },
  tabTextActive: {
    color: colors.primaryDark,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadows.md,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.darkLight,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.light,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.dark,
  },
  btn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  link: {
    alignSelf: 'center',
    marginTop: spacing.md,
    paddingVertical: 4,
  },
  linkText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: 'rgba(192, 57, 43, 0.08)',
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  successBox: {
    backgroundColor: 'rgba(152, 195, 164, 0.18)',
    borderLeftWidth: 4,
    borderLeftColor: colors.secondaryDark,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  successText: {
    color: colors.secondaryDark,
    fontSize: 13,
    lineHeight: 18,
  },
  infoBox: {
    backgroundColor: 'rgba(201, 137, 102, 0.08)',
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  infoText: {
    color: colors.darkLight,
    fontSize: 12,
    lineHeight: 17,
  },
  consentText: {
    fontSize: 12,
    color: colors.gray,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  consentLink: {
    color: colors.primary,
    fontWeight: '600',
  },
  legalFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  legalLink: {
    color: colors.gray,
    fontSize: 12,
    fontWeight: '600',
  },
  legalSep: {
    color: colors.grayLight,
    fontSize: 12,
  },
});
