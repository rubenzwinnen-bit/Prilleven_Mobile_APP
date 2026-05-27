/**
 * PROFILE SCREEN — fase 1 + 1.5
 *
 * Vier secties:
 *   1. Account         — e-mail tonen + uitloggen
 *   2. Community       — nickname + avatar (publiek zichtbaar in
 *                        community / chatruimtes / tijdlijn)
 *   3. Voorkeuren      — HapjesHeld memory-toggle
 *   4. Mijn gegevens   — GDPR: data-export + account verwijderen
 *
 * Entry-point: AvatarButton rechtsboven in LandingScreen-header.
 * Header: ChevronBack (geen home — we komen van Landing).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { useUser } from '../context/UserContext';
import { useToast } from '../components/Toast';
import { AvatarButton } from '../components/AvatarButton';
import {
  getMemoryEnabled,
  setMemoryEnabled,
  exportUserData,
  deleteAccount,
  getCommunityProfile,
  updateCommunityProfile,
  getAvatarUploadUrl,
  uploadAvatarToStorage,
  NICKNAME_REGEX,
} from '../services';
import type { CommunityProfile } from '../services';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

const CONFIRM_WORD = 'VERWIJDER';

/* Lokale chevron-back — geïnlined om een require-cycle met RootStack te vermijden
   (RootStack importeert ProfileScreen; ProfileScreen mag dus niets uit
   RootStack importeren). Visueel identiek aan ChevronBack in RootStack. */
const HEADER_CONTENT_HEIGHT = 42;

function ChevronBack({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={12}
      style={{ paddingRight: spacing.md }}
    >
      <Text
        style={{
          fontSize: 28,
          color: colors.primary,
          fontWeight: '300',
          marginTop: -2,
        }}
      >
        ‹
      </Text>
    </TouchableOpacity>
  );
}

export function ProfileScreen({ navigation }: Props) {
  const { user, logout } = useUser();
  const { show } = useToast();

  /* Memory-toggle state */
  const [memoryEnabled, setMemoryEnabledState] = useState<boolean | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(true);
  const [memorySaving, setMemorySaving] = useState(false);

  /* GDPR-export state */
  const [exporting, setExporting] = useState(false);

  /* GDPR-delete state */
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  /* Community-profile state */
  const [communityProfile, setCommunityProfile] =
    useState<CommunityProfile | null>(null);
  const [communityLoading, setCommunityLoading] = useState(true);
  const [nicknameInput, setNicknameInput] = useState('');
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  /* ----- Community-profile: initial load ----- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await getCommunityProfile();
        if (cancelled) return;
        setCommunityProfile(profile);
        setNicknameInput(profile?.nickname ?? '');
      } catch (err: any) {
        if (!cancelled) {
          show(err.message || 'Kon community-profiel niet laden.', 'error');
        }
      } finally {
        if (!cancelled) setCommunityLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [show]);

  const trimmedNickname = nicknameInput.trim().replace(/\s+/g, ' ');
  const nicknameValid = NICKNAME_REGEX.test(trimmedNickname);
  const nicknameDirty = trimmedNickname !== (communityProfile?.nickname ?? '');
  const canSaveNickname =
    nicknameValid && nicknameDirty && !nicknameSaving && !communityLoading;

  /* ----- Community-profile: save nickname ----- */
  const handleSaveNickname = useCallback(async () => {
    if (!canSaveNickname) return;
    setNicknameSaving(true);
    try {
      const updated = await updateCommunityProfile({
        nickname: trimmedNickname,
      });
      setCommunityProfile(updated);
      setNicknameInput(updated.nickname);
      show('Nickname opgeslagen.', 'success');
    } catch (err: any) {
      show(err.message || 'Nickname kon niet worden opgeslagen.', 'error');
    } finally {
      setNicknameSaving(false);
    }
  }, [canSaveNickname, trimmedNickname, show]);

  /* ----- Community-profile: avatar kiezen + uploaden -----
     Pipeline:
       1. ImagePicker (vraagt zelf om permissie)
       2. ImageManipulator → resize naar max 512px + JPEG q=0.8
       3. POST /api/community/profile/avatar-url → signed URL
       4. PUT blob naar signed URL
       5. PUT /api/community/profile { avatar_path } */
  const handlePickAvatar = useCallback(async () => {
    if (avatarUploading) return;
    if (!communityProfile?.nickname) {
      show(
        'Stel eerst een nickname in voordat je een foto kiest.',
        'info'
      );
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });
      if (result.canceled || !result.assets?.[0]) return;

      setAvatarUploading(true);
      const asset = result.assets[0];

      // Compress + resize naar max 512px JPEG (avatars moeten klein zijn).
      const processed = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 512 } }],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      const { path, uploadUrl } = await getAvatarUploadUrl();
      await uploadAvatarToStorage(processed.uri, uploadUrl, 'image/jpeg');
      const updated = await updateCommunityProfile({ avatar_path: path });
      setCommunityProfile(updated);
      show('Avatar bijgewerkt.', 'success');
    } catch (err: any) {
      show(err.message || 'Avatar uploaden mislukt.', 'error');
    } finally {
      setAvatarUploading(false);
    }
  }, [avatarUploading, communityProfile?.nickname, show]);

  /* ----- Community-profile: avatar verwijderen ----- */
  const handleRemoveAvatar = useCallback(() => {
    if (avatarUploading) return;
    if (!communityProfile?.avatar_path) return;
    Alert.alert('Avatar verwijderen?', 'Je profielfoto wordt verwijderd.', [
      { text: 'Annuleren', style: 'cancel' },
      {
        text: 'Verwijderen',
        style: 'destructive',
        onPress: async () => {
          setAvatarUploading(true);
          try {
            const updated = await updateCommunityProfile({
              avatar_path: null,
            });
            setCommunityProfile(updated);
            show('Avatar verwijderd.', 'success');
          } catch (err: any) {
            show(err.message || 'Verwijderen mislukt.', 'error');
          } finally {
            setAvatarUploading(false);
          }
        },
      },
    ]);
  }, [avatarUploading, communityProfile?.avatar_path, show]);

  /* ----- Memory-toggle: initial load ----- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const enabled = await getMemoryEnabled();
        if (!cancelled) setMemoryEnabledState(enabled);
      } catch (err: any) {
        if (!cancelled) {
          show(err.message || 'Kon profiel niet laden.', 'error');
          setMemoryEnabledState(true); // default
        }
      } finally {
        if (!cancelled) setMemoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [show]);

  /* ----- Memory-toggle: save ----- */
  const handleToggleMemory = useCallback(
    async (next: boolean) => {
      const prev = memoryEnabled;
      setMemoryEnabledState(next); // optimistic
      setMemorySaving(true);
      try {
        const confirmed = await setMemoryEnabled(next);
        setMemoryEnabledState(confirmed);
        show(
          confirmed
            ? 'HapjesHeld onthoudt nu informatie over je gezin.'
            : 'HapjesHeld onthoudt niets meer.',
          'success'
        );
      } catch (err: any) {
        setMemoryEnabledState(prev); // rollback
        show(err.message || 'Wijziging mislukt.', 'error');
      } finally {
        setMemorySaving(false);
      }
    },
    [memoryEnabled, show]
  );

  /* ----- GDPR-export ----- */
  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const json = await exportUserData();
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19);
      const filename = `pril-leven-export-${timestamp}.json`;

      const file = new File(Paths.cache, filename);
      if (file.exists) file.delete();
      file.create();
      file.write(json);

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        show(
          'Delen is niet beschikbaar op dit toestel. Bestand opgeslagen in cache.',
          'info'
        );
        return;
      }

      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Mijn Pril Leven data',
        UTI: 'public.json',
      });
    } catch (err: any) {
      show(err.message || 'Export mislukt.', 'error');
    } finally {
      setExporting(false);
    }
  }, [exporting, show]);

  /* ----- GDPR-delete ----- */
  const openDeleteModal = useCallback(() => {
    Alert.alert(
      'Weet je het zeker?',
      'Dit verwijdert je account, gesprekken, geheugen, weekschema\'s en favorieten. ' +
        'Publieke reacties worden geanonimiseerd. Deze actie is onomkeerbaar.',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Doorgaan',
          style: 'destructive',
          onPress: () => {
            setDeleteConfirmText('');
            setDeleteModalOpen(true);
          },
        },
      ]
    );
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (deleteConfirmText.trim() !== CONFIRM_WORD) return;
    setDeleting(true);
    try {
      await deleteAccount();
      setDeleteModalOpen(false);
      // Logout wist sessie + cache + zet user op '' → App.tsx toont AuthScreen
      await logout();
    } catch (err: any) {
      show(err.message || 'Verwijderen mislukt.', 'error');
      setDeleting(false);
    }
  }, [deleteConfirmText, logout, show]);

  const canConfirmDelete =
    deleteConfirmText.trim() === CONFIRM_WORD && !deleting;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <ChevronBack onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Mijn account</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ----- 1. ACCOUNT ----- */}
        <Section title="Account">
          <Row label="E-mailadres" value={user || '—'} />
          <Pressable
            style={({ pressed }) => [
              styles.btnSecondary,
              pressed && styles.btnPressed,
            ]}
            onPress={logout}
          >
            <Feather name="log-out" size={16} color={colors.danger} />
            <Text style={styles.btnSecondaryText}>Uitloggen</Text>
          </Pressable>
        </Section>

        {/* ----- 2. COMMUNITY ----- */}
        <Section title="Community">
          <Text style={styles.sectionIntro}>
            Je nickname en avatar zijn zichtbaar voor andere ouders in de
            community en in toekomstige chatruimtes.
          </Text>

          {communityLoading ? (
            <View style={styles.communityLoading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <>
              {/* Avatar-blok */}
              <View style={styles.avatarBlock}>
                <AvatarButton
                  email={user || ''}
                  avatarUrl={communityProfile?.avatar_url}
                  onPress={handlePickAvatar}
                  size={72}
                  accessibilityLabel="Profielfoto wijzigen"
                />
                <View style={styles.avatarActions}>
                  <Pressable
                    onPress={handlePickAvatar}
                    disabled={avatarUploading || !communityProfile?.nickname}
                    style={({ pressed }) => [
                      styles.btnGhost,
                      pressed && styles.btnPressed,
                      (avatarUploading || !communityProfile?.nickname) &&
                        styles.btnDisabled,
                    ]}
                  >
                    {avatarUploading ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Feather
                        name="camera"
                        size={14}
                        color={colors.primary}
                      />
                    )}
                    <Text style={styles.btnGhostText}>
                      {avatarUploading
                        ? 'Bezig…'
                        : communityProfile?.avatar_path
                        ? 'Foto wijzigen'
                        : 'Foto kiezen'}
                    </Text>
                  </Pressable>
                  {communityProfile?.avatar_path && !avatarUploading && (
                    <Pressable
                      onPress={handleRemoveAvatar}
                      style={({ pressed }) => [
                        styles.btnGhost,
                        pressed && styles.btnPressed,
                      ]}
                    >
                      <Feather name="x" size={14} color={colors.danger} />
                      <Text
                        style={[
                          styles.btnGhostText,
                          { color: colors.danger },
                        ]}
                      >
                        Verwijderen
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Nickname-input */}
              <Text style={styles.fieldLabel}>Nickname</Text>
              <TextInput
                style={styles.textInput}
                value={nicknameInput}
                onChangeText={setNicknameInput}
                placeholder="bv. Sarah_M"
                placeholderTextColor={colors.grayLight}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={30}
                editable={!nicknameSaving}
              />
              <Text style={styles.fieldHint}>
                2–30 tekens · letters, cijfers, spaties, _ en -
                {trimmedNickname.length > 0 && !nicknameValid
                  ? ' · ongeldig formaat'
                  : ''}
              </Text>

              <Pressable
                onPress={handleSaveNickname}
                disabled={!canSaveNickname}
                style={({ pressed }) => [
                  styles.btnPrimary,
                  pressed && styles.btnPressed,
                  !canSaveNickname && styles.btnDisabled,
                ]}
              >
                {nicknameSaving ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.btnPrimaryText}>
                    {communityProfile?.nickname
                      ? 'Nickname opslaan'
                      : 'Nickname aanmaken'}
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </Section>

        {/* ----- 3. VOORKEUREN ----- */}
        <Section title="Voorkeuren & privacy">
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextWrap}>
              <Text style={styles.toggleTitle}>
                HapjesHeld onthoudt mijn gezin
              </Text>
              <Text style={styles.toggleSub}>
                Aan: relevante info uit eerdere gesprekken wordt meegegeven aan
                de AI zodat antwoorden persoonlijker zijn. Uit: elke chat start
                schoon, niets wordt onthouden.
              </Text>
            </View>
            {memoryLoading || memoryEnabled === null ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Switch
                value={memoryEnabled}
                onValueChange={handleToggleMemory}
                disabled={memorySaving}
                trackColor={{
                  false: colors.grayLight,
                  true: colors.secondary,
                }}
                thumbColor={colors.white}
                ios_backgroundColor={colors.grayLight}
              />
            )}
          </View>
        </Section>

        {/* ----- 4. MIJN GEGEVENS (GDPR) ----- */}
        <Section title="Mijn gegevens">
          <Text style={styles.gdprIntro}>
            Onder de AVG/GDPR heb je recht op inzage en op verwijdering van je
            persoonlijke data.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.btnSecondary,
              pressed && styles.btnPressed,
              exporting && styles.btnDisabled,
            ]}
            onPress={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Feather name="download" size={16} color={colors.primary} />
            )}
            <Text style={styles.btnSecondaryTextPrimary}>
              {exporting ? 'Bezig met exporteren…' : 'Download mijn data'}
            </Text>
          </Pressable>

          <Text style={styles.gdprHint}>
            Je krijgt een JSON-bestand met je conversaties, geheugen-items,
            profiel en abonnementsinfo.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.btnDanger,
              pressed && styles.btnPressed,
            ]}
            onPress={openDeleteModal}
          >
            <Feather name="trash-2" size={16} color={colors.white} />
            <Text style={styles.btnDangerText}>Verwijder mijn account</Text>
          </Pressable>
        </Section>

        <Text style={styles.footer}>
          Pril Leven — Community
        </Text>
      </ScrollView>

      {/* ----- DELETE-MODAL ----- */}
      <Modal
        visible={deleteModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !deleting && setDeleteModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Account definitief verwijderen</Text>
            <Text style={styles.modalText}>
              Typ <Text style={styles.modalBold}>{CONFIRM_WORD}</Text> in
              hoofdletters om te bevestigen dat je je account onomkeerbaar wil
              verwijderen.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder={CONFIRM_WORD}
              placeholderTextColor={colors.grayLight}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!deleting}
            />
            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalBtnCancel,
                  pressed && styles.btnPressed,
                ]}
                onPress={() => setDeleteModalOpen(false)}
                disabled={deleting}
              >
                <Text style={styles.modalBtnCancelText}>Annuleren</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalBtnConfirm,
                  pressed && styles.btnPressed,
                  !canConfirmDelete && styles.btnDisabled,
                ]}
                onPress={handleConfirmDelete}
                disabled={!canConfirmDelete}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.modalBtnConfirmText}>
                    Definitief verwijderen
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ----------------------------------------
   Sub-componenten
---------------------------------------- */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    height: HEADER_CONTENT_HEIGHT,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.dark,
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gray,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    ...shadows.sm,
  },
  /* Row (label + value) */
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  rowLabel: {
    fontSize: 14,
    color: colors.gray,
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 14,
    color: colors.dark,
    fontWeight: '600',
    flexShrink: 1,
    marginLeft: spacing.md,
    textAlign: 'right',
  },
  /* Toggle-row */
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  toggleTextWrap: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: spacing.xs,
  },
  toggleSub: {
    fontSize: 12,
    color: colors.gray,
    lineHeight: 17,
  },
  /* Community */
  sectionIntro: {
    fontSize: 13,
    color: colors.gray,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  communityLoading: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  avatarBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  avatarActions: {
    flex: 1,
    gap: spacing.xs,
  },
  btnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  btnGhostText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.dark,
    marginBottom: spacing.xs,
  },
  textInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.light,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.dark,
  },
  fieldHint: {
    fontSize: 11,
    color: colors.gray,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    marginTop: spacing.xs,
  },
  btnPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  /* GDPR */
  gdprIntro: {
    fontSize: 13,
    color: colors.gray,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  gdprHint: {
    fontSize: 11,
    color: colors.gray,
    lineHeight: 16,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    fontStyle: 'italic',
  },
  /* Buttons */
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.light,
    backgroundColor: colors.bg,
    marginTop: spacing.sm,
  },
  btnSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.danger,
  },
  btnSecondaryTextPrimary: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  btnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: colors.danger,
  },
  btnDangerText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  btnPressed: {
    opacity: 0.65,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  footer: {
    textAlign: 'center',
    color: colors.grayLight,
    fontSize: 11,
    marginTop: spacing.lg,
  },
  /* Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadows.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: spacing.sm,
  },
  modalText: {
    fontSize: 14,
    color: colors.darkLight,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  modalBold: {
    fontWeight: '800',
    color: colors.danger,
  },
  modalInput: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.light,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    fontWeight: '700',
    color: colors.dark,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancel: {
    backgroundColor: colors.light,
  },
  modalBtnCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.dark,
  },
  modalBtnConfirm: {
    backgroundColor: colors.danger,
  },
  modalBtnConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
});
