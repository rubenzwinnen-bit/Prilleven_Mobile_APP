/**
 * EERSTE HAPJES SCREEN — v2.8.5 (setup-flow + website-paritaire lay-out)
 *
 * Spiegel van de website-component `js/components/allergenen.js`. Toont per
 * kind:
 *   1. "Reeds geïntroduceerd?"-setup (eenmalig, voor !setup_done)  ← v2.8.5
 *   2. "Hoeveelheden"-box (collapsible)            ← v2.7.0
 *   3. Pauze-banner (read-only)                    ← v2.5.0
 *   4. "Volgende stap"-banner met foto-rechts       ← v2.7.0
 *   5. 9 allergenen als foto-cards (accordeon)      ← v2.7.0
 *   6. Symptoomlog-knop                             ← v2.6.0
 *
 * Setup-flow (v2.8.5):
 *   Bij eerste opening (state.allergen_state.setup_done === false) tonen we
 *   een paritaire kaart met "Reeds geïntroduceerd? Vink aan welke allergenen
 *   ${kind.name} al regelmatig en zonder reactie heeft gegeten." Bevestigen
 *   → PATCH state met { pre_introduced, setup_done: true, started: true }.
 *
 * Route: 'EersteHapjes' { childId } — bereikbaar via Landing-tile →
 * AllergenenChildrenScreen (kind-picker).
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
  ImageBackground,
  ImageSourcePropType,
  Image,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { useToast } from '../components/Toast';
import {
  getChildren,
  formatAge,
  ageInMonths,
  getEhState,
  getEhDoses,
  getEhSymptoms,
  buildAllergenContext,
  getAllergenStatus,
  successfulDoseCount,
  ALLERGEN_FLOW,
  ALLERGEN_TARGET_DOSES,
  patchEhState,
  updateChild,
} from '../services';
import type {
  Child,
  EhState,
  EhDose,
  EhSymptom,
  AllergenStatus,
  AllergenContext,
  AllergenFlowItem,
  SymptomSeverity,
} from '../services';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EersteHapjes'>;

const HEADER_CONTENT_HEIGHT = 42;

/* Activeer LayoutAnimation op Android (iOS staat al aan). */
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Subtiele "easeInEaseOut"-animatie voor het uitklappen van allergeen-cards. */
function easeAccordion() {
  LayoutAnimation.configureNext({
    duration: 220,
    create: { type: 'easeInEaseOut', property: 'opacity' },
    update: { type: 'easeInEaseOut' },
    delete: { type: 'easeInEaseOut', property: 'opacity' },
  });
}

/** Spiegel van `shouldShowArtsWarning()` in `js/components/allergenen.js`:
 *  toont de gele arts-warn-banner als er in de laatste 14 dagen een dose met
 *  reactie 'ernstig' of een symptoom met severity 'heftig' werd gelogd. */
function shouldShowArtsWarning(doses: EhDose[], symptoms: EhSymptom[]) {
  const cutoff = Date.now() - 14 * 86400000;
  const recentErnstigeDose = doses.some(d => {
    if (d.reaction !== 'ernstig') return false;
    const t = new Date((d.intro_date || '') + 'T00:00:00Z').getTime();
    return Number.isFinite(t) && t >= cutoff;
  });
  const recentHeftigSymptom = symptoms.some(s => {
    if (s.severity !== 'heftig') return false;
    const t = new Date(s.occurred_at || 0).getTime();
    return Number.isFinite(t) && t >= cutoff;
  });
  return recentErnstigeDose || recentHeftigSymptom;
}

/* ----------------------------------------
   Foto's per allergeen — Metro vereist statische require()-paden
---------------------------------------- */
const ALLERGEN_PHOTOS: Record<string, ImageSourcePropType> = {
  'kippen-ei': require('../../assets/allergens/kippen-ei.jpg'),
  pinda: require('../../assets/allergens/pinda.jpg'),
  noten: require('../../assets/allergens/noten.jpg'),
  sesam: require('../../assets/allergens/sesam.jpg'),
  vis: require('../../assets/allergens/vis.jpg'),
  schaaldieren: require('../../assets/allergens/schaaldieren.jpg'),
  soja: require('../../assets/allergens/soja.jpg'),
  tarwe: require('../../assets/allergens/tarwe.jpg'),
  koemelk: require('../../assets/allergens/koemelk.jpg'),
};

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

interface StatusVisual {
  label: string;
  color: string;
  icon: keyof typeof Feather.glyphMap;
}

function statusVisual(
  status: AllergenStatus,
  successCount: number
): StatusVisual {
  switch (status) {
    case 'veilig':
      return {
        label: '✅ Veilig',
        color: colors.secondaryDark,
        icon: 'check-circle',
      };
    case 'in-progress':
      return {
        label: `🟡 ${successCount}/3`,
        color: colors.primary,
        icon: 'clock',
      };
    case 'allergisch':
      return {
        label: '⚠️ Allergisch',
        color: colors.danger,
        icon: 'alert-triangle',
      };
    case 'paused':
      return {
        label: '⏸️ Gepauzeerd',
        color: colors.warning,
        icon: 'pause-circle',
      };
    case 'excluded':
      return {
        label: '🚫 Overgeslagen',
        color: colors.gray,
        icon: 'slash',
      };
    case 'wacht':
    default:
      return {
        label: '⚪ Wachten',
        color: colors.gray,
        icon: 'circle',
      };
  }
}

/* ----------------------------------------
   Hoeveelheden-box (collapsible)
---------------------------------------- */
function HoeveelhedenBox() {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.hoeveelheden}>
      <Pressable
        onPress={() => {
          easeAccordion();
          setOpen(o => !o);
        }}
        style={styles.hoeveelhedenHead}
      >
        <Text style={styles.hoeveelhedenTitle}>📏 Hoeveelheden</Text>
        <Feather
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.darkLight}
        />
      </Pressable>
      {open && (
        <View style={styles.hoeveelhedenBody}>
          <Text style={styles.hoeveelhedenItem}>
            <Text style={styles.bold}>Introductie 1:</Text> starten met ¼
            koffielepel
          </Text>
          <Text style={styles.hoeveelhedenItem}>
            <Text style={styles.bold}>Introductie 2:</Text> ½ koffielepel
          </Text>
          <Text style={styles.hoeveelhedenItem}>
            <Text style={styles.bold}>Introductie 3:</Text> volledige
            koffielepel
          </Text>
        </View>
      )}
    </View>
  );
}

/* ----------------------------------------
   Volgende stap-banner met foto rechts + gradient
---------------------------------------- */
interface NextUpBannerProps {
  allergen: AllergenFlowItem;
  doseNumber: 1 | 2 | 3;
  onPress: () => void;
}

function NextUpBanner({
  allergen,
  doseNumber,
  onPress,
}: NextUpBannerProps) {
  const photo = ALLERGEN_PHOTOS[allergen.key];
  return (
    <View style={styles.nextUp}>
      {photo ? (
        <Image source={photo} style={styles.nextUpBg} resizeMode="cover" />
      ) : null}
      <LinearGradient
        colors={[
          'rgba(238,243,232,1)',
          'rgba(238,243,232,0.92)',
          'rgba(238,243,232,0.4)',
        ]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        locations={[0, 0.55, 1]}
        style={styles.nextUpGradient}
      />
      <View style={styles.nextUpContent}>
        <Text style={styles.nextUpLabel}>VOLGENDE STAP</Text>
        <Text style={styles.nextUpTitle}>
          {allergen.label} — introductie {doseNumber}/3
        </Text>
        <Text style={styles.nextUpSub} numberOfLines={2}>
          {allergen.suggestion}
        </Text>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.nextUpCta,
            pressed && styles.btnPressed,
          ]}
        >
          <Text style={styles.nextUpCtaText}>
            Introductie {doseNumber} registreren
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ----------------------------------------
   Severity-weergave voor symptoom-lijstjes per tegel
---------------------------------------- */
const SEVERITY_DISPLAY: Record<
  SymptomSeverity,
  { icon: string; label: string }
> = {
  mild: { icon: '🟢', label: 'Mild' },
  matig: { icon: '🟠', label: 'Twijfel' },
  heftig: { icon: '🔴', label: 'Ernstig' },
};

const SYMPTOM_DETAIL_LABELS: Record<string, Record<string, string>> = {
  time_after_eating: {
    direct: 'Direct (<15 min)',
    snel: 'Snel (15 min – 1 u)',
    later: 'Later (1 – 4 u)',
    'veel-later': 'Veel later (>4 u)',
    onbekend: 'Onbekend tijdstip',
  },
  duration: {
    kort: 'Kort (<30 min)',
    'paar-uur': 'Een paar uur',
    'halve-dag': 'Een halve dag',
    'dag-of-langer': 'Een dag of langer',
    'nog-bezig': 'Nog bezig',
  },
  worsened: {
    stabiel: 'Bleef stabiel',
    'langzaam-erger': 'Langzaam erger',
    'snel-erger': 'Snel erger',
    minder: 'Werden minder',
  },
  behavior: {
    normaal: 'Normaal',
    onrustig: 'Onrustig/huilerig',
    ongemakkelijk: 'Erg ongemakkelijk',
    suf: 'Suf/lethargisch',
  },
};

function symptomDetailChips(s: EhSymptom): string[] {
  const out: string[] = [];
  for (const f of ['time_after_eating', 'duration', 'worsened', 'behavior'] as const) {
    const v = s[f];
    if (!v) continue;
    const label = SYMPTOM_DETAIL_LABELS[f]?.[v];
    if (label) out.push(label);
  }
  return out;
}

function formatSymptomDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('nl-BE', {
    day: 'numeric',
    month: 'short',
  });
  const time = d.toLocaleTimeString('nl-BE', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${date} ${time}`;
}

/* ----------------------------------------
   AllergenCard — foto-header + accordeon
---------------------------------------- */
interface AllergenCardProps {
  allergen: AllergenFlowItem;
  status: AllergenStatus;
  successCount: number;
  totalDoses: number;
  open: boolean;
  doses: EhDose[];
  symptoms: EhSymptom[];
  onToggle: () => void;
  onEditDose: (doseId: string) => void;
  onEditSymptom: (symptomId: string) => void;
  /* v2.9.0: arts-toezicht laat de gebruiker een allergeen overslaan
     (paritair met `data-action="toggle-exclude"` op de website). */
  showExcludeBtn?: boolean;
  isExcluded?: boolean;
  excludeBusy?: boolean;
  onToggleExclude?: () => void;
}

/** Kleur-stijlen per reactie-niveau van een geregistreerde introductie.
 *  Spiegel van `.allergenen-dose--mild` / `.allergenen-dose--ernstig` op de website. */
const DOSE_REACTION_BORDER: Record<string, string | null> = {
  geen: null,
  mild: '#e6b800',
  ernstig: '#d9534f',
};

/** Kleur-stijlen per ernst van een symptoom. Spiegel van
 *  `.allergenen-symptom--mild|matig|heftig` op de website. */
const SYMPTOM_SEVERITY_STYLE: Record<
  SymptomSeverity,
  { bg: string; border: string }
> = {
  mild: { bg: '#ecf5ed', border: '#6cae72' },
  matig: { bg: '#fff4e2', border: '#e9a23b' },
  heftig: { bg: '#fdecec', border: '#d95553' },
};

function AllergenCard({
  allergen,
  status,
  successCount,
  totalDoses,
  open,
  doses,
  symptoms,
  onToggle,
  onEditDose,
  onEditSymptom,
  showExcludeBtn = false,
  isExcluded = false,
  excludeBusy = false,
  onToggleExclude,
}: AllergenCardProps) {
  const visual = statusVisual(status, successCount);
  const photo = ALLERGEN_PHOTOS[allergen.key];
  const stuck =
    doses.length >= 3 && status !== 'veilig' && status !== 'allergisch';

  return (
    <View style={styles.card}>
      {/* Header met foto + chips */}
      <Pressable
        onPress={onToggle}
        accessibilityLabel={`${allergen.label} — ${visual.label}`}
      >
        <ImageBackground
          source={photo}
          style={styles.cardHeader}
          imageStyle={[
            styles.cardHeaderImg,
            { opacity: open ? 1 : 0.42 },
          ]}
          resizeMode="cover"
        >
          {/* Lichte donker-gradient onderaan voor leesbaarheid */}
          <LinearGradient
            colors={
              open
                ? ['rgba(0,0,0,0)', 'rgba(0,0,0,0.18)']
                : ['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.1)']
            }
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.cardHeaderRow}>
            <View style={styles.labelChip}>
              <Text style={styles.labelChipText}>{allergen.label}</Text>
            </View>
            <View style={styles.headerRight}>
              <View style={styles.statusChip}>
                <Text style={[styles.statusChipText, { color: visual.color }]}>
                  {visual.label}
                </Text>
              </View>
              <View style={styles.caretChip}>
                <Feather
                  name={open ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.darkLight}
                />
              </View>
            </View>
          </View>

          {/* Arts-toezicht: "Overslaan"/"Opnemen"-toggle paritair met
             `data-action="toggle-exclude"` op de website. v2.9.1: enkel
             tekst, en op de foto-header zelf (bottom-right) zodat de
             foto over de hele gesloten tegel zichtbaar blijft. */}
          {showExcludeBtn && onToggleExclude && (
            <Pressable
              onPress={onToggleExclude}
              disabled={excludeBusy}
              style={({ pressed }) => [
                styles.excludeBtn,
                pressed && !excludeBusy && styles.excludeBtnPressed,
                excludeBusy && styles.excludeBtnDisabled,
              ]}
              accessibilityLabel={
                isExcluded
                  ? `${allergen.label} opnieuw opnemen`
                  : `${allergen.label} overslaan`
              }
            >
              <Text style={styles.excludeBtnText}>
                {isExcluded ? 'Opnemen' : 'Overslaan'}
              </Text>
            </Pressable>
          )}
        </ImageBackground>
      </Pressable>

      {/* Body — alleen zichtbaar wanneer open */}
      {open && (
        <View style={styles.cardBody}>
          {/* Gepureerde voeding */}
          {allergen.content?.puree && allergen.content.puree.length > 0 && (
            <View style={styles.contentSection}>
              <Text style={styles.contentTitle}>Gepureerde voeding</Text>
              {allergen.content.puree.map((tip, i) => (
                <Text key={`p-${i}`} style={styles.contentBullet}>
                  • {tip}
                </Text>
              ))}
            </View>
          )}

          {/* Stukjes */}
          {allergen.content?.pieces && allergen.content.pieces.length > 0 && (
            <View style={styles.contentSection}>
              <Text style={styles.contentTitle}>Stukjes</Text>
              {allergen.content.pieces.map((tip, i) => (
                <Text key={`s-${i}`} style={styles.contentBullet}>
                  • {tip}
                </Text>
              ))}
            </View>
          )}

          {status === 'allergisch' && (
            <Text style={styles.cardBodyHint}>
              Op het profiel staat dat dit kind allergisch is. Geen verdere
              introducties nodig.
            </Text>
          )}
          {status === 'veilig' && (
            <Text style={styles.cardBodyHint}>
              Dit allergeen is succesvol geïntroduceerd. 🎉
            </Text>
          )}
          {stuck && (
            <Text style={styles.cardBodyHint}>
              Er was een reactie tijdens de 3 introducties — dit allergeen
              heeft geen 3× <Text style={styles.italic}>geen reactie</Text>.
            </Text>
          )}

          {/* Geregistreerde introducties — inline lijst (paritaire kleurcodes) */}
          {doses.length > 0 && (
            <View style={styles.logSection}>
              <Text style={styles.logTitle}>Geregistreerde introducties</Text>
              {doses.map(d => {
                const borderColor = DOSE_REACTION_BORDER[d.reaction] ?? null;
                return (
                  <View
                    key={d.id}
                    style={[
                      styles.doseRow,
                      borderColor
                        ? { borderLeftWidth: 3, borderLeftColor: borderColor }
                        : null,
                    ]}
                  >
                    <View style={styles.doseRowHead}>
                      <Text style={styles.doseRowNum}>
                        Introductie {d.dose_number}
                      </Text>
                      <Text style={styles.doseRowDate}>
                        {d.intro_date ?? ''}
                      </Text>
                      <Pressable
                        onPress={() => onEditDose(d.id)}
                        hitSlop={10}
                        style={({ pressed }) => [
                          styles.editBtn,
                          pressed && styles.editBtnPressed,
                        ]}
                        accessibilityLabel="Introductie bewerken"
                      >
                        <Feather name="edit-2" size={14} color={colors.gray} />
                      </Pressable>
                    </View>
                    {d.notes ? (
                      <Text style={styles.doseRowNotes}>{d.notes}</Text>
                    ) : null}
                  </View>
                );
              })}
              <Text style={styles.logProgress}>
                {successCount}/{ALLERGEN_TARGET_DOSES} geslaagd
                {totalDoses > successCount
                  ? ` · ${totalDoses} totaal geregistreerd`
                  : ''}
              </Text>
            </View>
          )}

          {/* Gelogde symptomen — inline lijst (paritaire kleurcodes) */}
          {symptoms.length > 0 && (
            <View style={styles.logSection}>
              <Text style={styles.logTitle}>Gelogde reacties</Text>
              {symptoms.map(s => {
                const sev = SEVERITY_DISPLAY[s.severity] ?? {
                  icon: '⚪',
                  label: s.severity,
                };
                const sevStyle = SYMPTOM_SEVERITY_STYLE[s.severity] ?? {
                  bg: '#fafafa',
                  border: '#cccccc',
                };
                const chips = symptomDetailChips(s);
                return (
                  <View
                    key={s.id}
                    style={[
                      styles.symptomRow,
                      {
                        backgroundColor: sevStyle.bg,
                        borderLeftColor: sevStyle.border,
                      },
                    ]}
                  >
                    <View style={styles.symptomRowHead}>
                      <Text style={styles.symptomRowSeverity}>
                        {sev.icon} {sev.label}
                      </Text>
                      <Text style={styles.symptomRowDate}>
                        {formatSymptomDateTime(s.occurred_at)}
                      </Text>
                      <Pressable
                        onPress={() => onEditSymptom(s.id)}
                        hitSlop={10}
                        style={({ pressed }) => [
                          styles.editBtn,
                          pressed && styles.editBtnPressed,
                        ]}
                        accessibilityLabel="Symptoom bewerken"
                      >
                        <Feather name="edit-2" size={14} color={colors.gray} />
                      </Pressable>
                    </View>
                    {chips.length > 0 && (
                      <View style={styles.logChipRow}>
                        {chips.map((c, i) => (
                          <View key={i} style={styles.logChip}>
                            <Text style={styles.logChipText}>{c}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    {s.notes ? (
                      <Text style={styles.symptomRowNotes}>{s.notes}</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

/* ----------------------------------------
   PauseFlowCard — spiegel van `renderPauseFlow()` in
   `js/components/allergenen.js`. Vervangt de allergenen-grid wanneer
   `allergen_state.paused === true` en `paused_step >= 1`. Drie stappen:
     1) Info-kaart ('Gelezen')
     2) "Arts geraadpleegd?" ('Ja')
     3) "Allergie bevestigen?" ('Ja, allergisch' / 'Nee')
---------------------------------------- */
interface PauseFlowCardProps {
  childName: string;
  pauseType: 'twijfel' | 'ernstig';
  step: 1 | 2 | 3;
  allergenLabel: string;
  busy: boolean;
  onAdvance: () => void;
  onAllergyConfirmed: () => void;
  onAllergyDenied: () => void;
}

function PauseFlowCard({
  childName,
  pauseType,
  step,
  allergenLabel,
  busy,
  onAdvance,
  onAllergyConfirmed,
  onAllergyDenied,
}: PauseFlowCardProps) {
  const isErnstigStep1 = pauseType === 'ernstig' && step === 1;

  let icon: string | null = null;
  let title = '';
  let body: React.ReactNode = null;
  let actions: React.ReactNode = null;

  if (step === 1) {
    if (pauseType === 'twijfel') {
      icon = '⚠️';
      title = 'Reactie met twijfel geregistreerd';
      body = (
        <>
          <Text style={styles.pauseFlowText}>
            Je hebt een symptoom ingevoerd waar je twijfelde over de ernst van
            de reactie van je kind. Ga eerst langs je arts om deze reactie te
            bespreken.
          </Text>
          <Text style={styles.pauseFlowSub}>
            De introductie van allergenen is tijdelijk gepauzeerd.
          </Text>
        </>
      );
      actions = (
        <Pressable
          onPress={onAdvance}
          disabled={busy}
          style={({ pressed }) => [
            styles.pauseFlowBtn,
            styles.pauseFlowBtnPrimary,
            pressed && styles.btnPressed,
            busy && styles.btnDisabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.pauseFlowBtnTextPrimary}>Gelezen</Text>
          )}
        </Pressable>
      );
    } else {
      title = 'Allergeen (tijdelijk) niet meer aanbieden';
      body = (
        <>
          <Text style={styles.pauseFlowText}>
            Contacteer je pediater of kinderdiëtiste voor een plan van aanpak.
          </Text>
          <Text style={styles.pauseFlowSub}>
            De introductie van allergenen is volledig gepauzeerd.
          </Text>
        </>
      );
      actions = (
        <Pressable
          onPress={onAdvance}
          disabled={busy}
          style={({ pressed }) => [
            styles.pauseFlowBtn,
            styles.pauseFlowBtnDanger,
            pressed && styles.btnPressed,
            busy && styles.btnDisabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.pauseFlowBtnTextPrimary}>Gelezen</Text>
          )}
        </Pressable>
      );
    }
  } else if (step === 2) {
    icon = '🏥';
    title = 'Arts geraadpleegd?';
    body = (
      <Text style={styles.pauseFlowText}>
        Heb je een afspraak gehad bij je arts om de laatste reactie van je
        kindje te bespreken?
      </Text>
    );
    actions = (
      <Pressable
        onPress={onAdvance}
        disabled={busy}
        style={({ pressed }) => [
          styles.pauseFlowBtn,
          styles.pauseFlowBtnPrimary,
          pressed && styles.btnPressed,
          busy && styles.btnDisabled,
        ]}
      >
        {busy ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.pauseFlowBtnTextPrimary}>Ja</Text>
        )}
      </Pressable>
    );
  } else {
    icon = '❓';
    title = 'Allergie bevestigen';
    body = (
      <Text style={styles.pauseFlowText}>
        Is <Text style={styles.bold}>{childName}</Text> allergisch aan{' '}
        <Text style={styles.bold}>{allergenLabel}</Text>?
      </Text>
    );
    actions = (
      <View style={styles.pauseFlowActionsRow}>
        <Pressable
          onPress={onAllergyConfirmed}
          disabled={busy}
          style={({ pressed }) => [
            styles.pauseFlowBtn,
            styles.pauseFlowBtnDanger,
            pressed && styles.btnPressed,
            busy && styles.btnDisabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.pauseFlowBtnTextPrimary}>Ja, allergisch</Text>
          )}
        </Pressable>
        <Pressable
          onPress={onAllergyDenied}
          disabled={busy}
          style={({ pressed }) => [
            styles.pauseFlowBtn,
            styles.pauseFlowBtnPrimary,
            pressed && styles.btnPressed,
            busy && styles.btnDisabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.pauseFlowBtnTextPrimary}>Nee</Text>
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.pauseFlowCard,
        isErnstigStep1 && styles.pauseFlowCardErnstig,
      ]}
    >
      {icon ? <Text style={styles.pauseFlowIcon}>{icon}</Text> : null}
      <Text style={styles.pauseFlowTitle}>{title}</Text>
      {body}
      <View style={styles.pauseFlowActions}>{actions}</View>
    </View>
  );
}

/* ----------------------------------------
   DisabledCard — spiegel van `renderDisabled()` in
   `js/components/allergenen.js`. Getoond wanneer `allergen_state.opted_out`:
   de gebruiker koos in het kindprofiel om de functie niet te volgen. Met
   "Toch volgen"-knop die de functie weer aanzet (welkomscherm).
---------------------------------------- */
interface DisabledCardProps {
  childName: string;
  busy: boolean;
  onReenable: () => void;
}

function DisabledCard({ childName, busy, onReenable }: DisabledCardProps) {
  return (
    <View style={styles.welcomeCard}>
      <Text style={styles.welcomeIcon}>🔕</Text>
      <Text style={styles.welcomeTitle}>
        Allergenen-introductie staat uit voor {childName}
      </Text>
      <Text style={styles.welcomeBody}>
        Je hebt aangegeven deze functie niet te volgen voor {childName}. Je
        kunt dit altijd weer aanzetten.
      </Text>
      <Pressable
        onPress={onReenable}
        disabled={busy}
        style={({ pressed }) => [
          styles.welcomeBtn,
          pressed && styles.btnPressed,
          busy && styles.btnDisabled,
        ]}
      >
        {busy ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.welcomeBtnText}>Toch volgen</Text>
        )}
      </Pressable>
    </View>
  );
}

/* ----------------------------------------
   WelcomeCard — spiegel van `renderWelcome()` in
   `js/components/allergenen.js`. Eerste stap bij !started: intro-tekst +
   "Start met introduceren"-knop.
---------------------------------------- */
interface WelcomeCardProps {
  childName: string;
  busy: boolean;
  onStart: () => void;
}

function WelcomeCard({ childName, busy, onStart }: WelcomeCardProps) {
  return (
    <View style={styles.welcomeCard}>
      <Text style={styles.welcomeIcon}>🍽️</Text>
      <Text style={styles.welcomeTitle}>
        Klaar om allergenen te introduceren voor {childName}?
      </Text>
      <Text style={styles.welcomeBody}>
        We begeleiden je door de 9 allergenen, in de juiste volgorde, met
        telkens 3 introducties zonder reactie om een allergeen als veilig te
        markeren.
      </Text>
      <Text style={styles.welcomeBody}>
        Je kiest zelf wanneer je start, wanneer je naar het volgende allergeen
        gaat en wanneer je een nieuwe introductie registreert. Bekende
        allergieën uit het profiel slaan we automatisch over.
      </Text>
      <Pressable
        onPress={onStart}
        disabled={busy}
        style={({ pressed }) => [
          styles.welcomeBtn,
          pressed && styles.btnPressed,
          busy && styles.btnDisabled,
        ]}
      >
        {busy ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.welcomeBtnText}>Start met introduceren</Text>
        )}
      </Pressable>
    </View>
  );
}

/* ----------------------------------------
   SetupCard — spiegel van `renderSetup()` in `js/components/allergenen.js`.
   "Reeds geïntroduceerd? Vink aan welke allergenen al regelmatig en zonder
   reactie zijn gegeten." Met foto-achtergrond per rij (rechts), gradient van
   sage-groen naar transparant — paritair met `.allergenen-setup-item[data-key]`.
---------------------------------------- */
interface SetupCardProps {
  childName: string;
  knownAllergies: string[];
  busy: boolean;
  onFinalize: (preIntroduced: string[]) => void;
}

function SetupCard({
  childName,
  knownAllergies,
  busy,
  onFinalize,
}: SetupCardProps) {
  const candidates = useMemo(
    () =>
      [...ALLERGEN_FLOW]
        .sort((a, b) => a.order - b.order)
        .filter(a => !knownAllergies.includes(a.key)),
    [knownAllergies]
  );
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const toggle = (key: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  return (
    <View style={styles.setupCard}>
      <Text style={styles.setupTitle}>Reeds geïntroduceerd?</Text>
      <Text style={styles.setupBody}>
        Vink aan welke allergenen <Text style={styles.bold}>{childName}</Text>{' '}
        al regelmatig en zonder reactie heeft gegeten. Deze slaan we over — je
        hoeft hier geen introducties meer voor te loggen.
      </Text>
      {candidates.length === 0 ? (
        <Text style={styles.setupEmpty}>Geen allergenen om te markeren.</Text>
      ) : (
        <View style={styles.setupList}>
          {candidates.map(a => {
            const isChecked = checked.has(a.key);
            const photo = ALLERGEN_PHOTOS[a.key];
            return (
              <Pressable
                key={a.key}
                onPress={() => toggle(a.key)}
                disabled={busy}
                style={({ pressed }) => [
                  styles.setupItem,
                  isChecked && styles.setupItemChecked,
                  pressed && styles.setupItemPressed,
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isChecked }}
              >
                {photo ? (
                  <Image
                    source={photo}
                    style={styles.setupItemBg}
                    resizeMode="cover"
                  />
                ) : null}
                <LinearGradient
                  colors={[
                    '#eef3e8',
                    'rgba(238,243,232,0.92)',
                    'rgba(238,243,232,0.4)',
                  ]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  locations={[0.4, 0.65, 1]}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.setupItemContent}>
                  <View
                    style={[
                      styles.setupBox,
                      isChecked && styles.setupBoxChecked,
                    ]}
                  >
                    {isChecked && (
                      <Feather name="check" size={14} color={colors.white} />
                    )}
                  </View>
                  <Text style={styles.setupItemLabel}>{a.label}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
      <View style={styles.setupActions}>
        <Pressable
          onPress={() => onFinalize([])}
          disabled={busy}
          style={({ pressed }) => [
            styles.setupBtn,
            styles.setupBtnOutline,
            pressed && styles.btnPressed,
            busy && styles.btnDisabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.setupBtnOutlineText}>Niets aanvinken</Text>
          )}
        </Pressable>
        <Pressable
          onPress={() => onFinalize(Array.from(checked))}
          disabled={busy}
          style={({ pressed }) => [
            styles.setupBtn,
            styles.setupBtnPrimary,
            pressed && styles.btnPressed,
            busy && styles.btnDisabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.setupBtnPrimaryText}>Verder</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

/* ----------------------------------------
   EersteHapjesScreen
---------------------------------------- */
export function EersteHapjesScreen({ navigation, route }: Props) {
  const { show } = useToast();
  const { childId } = route.params;

  const [child, setChild] = useState<Child | null>(null);
  const [state, setState] = useState<EhState | null>(null);
  const [doses, setDoses] = useState<EhDose[]>([]);
  const [symptoms, setSymptoms] = useState<EhSymptom[]>([]);
  const [loading, setLoading] = useState(true);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [pauseBusy, setPauseBusy] = useState(false);
  const [setupBusy, setSetupBusy] = useState(false);
  const [welcomeBusy, setWelcomeBusy] = useState(false);
  const [reenableBusy, setReenableBusy] = useState(false);
  /* v2.9.0: per-allergeen busy-flag voor de "Overslaan"/"Opnemen"-toggle
     (paritair met `toggleAllergenExcluded()` op de website). */
  const [excludeBusyKey, setExcludeBusyKey] = useState<string | null>(null);

  const loadAll = useCallback(
    async (signal?: { cancelled: boolean }) => {
      try {
        const list = await getChildren();
        if (signal?.cancelled) return;
        const target = list.find(c => c.id === childId);
        if (!target) {
          show('Kind niet gevonden.', 'error');
          navigation.goBack();
          return;
        }
        setChild(target);

        const [s, d, sy] = await Promise.all([
          getEhState(childId).catch(() => null),
          getEhDoses(childId).catch(() => [] as EhDose[]),
          getEhSymptoms(childId, { limit: 200 }).catch(
            () => [] as EhSymptom[]
          ),
        ]);
        if (signal?.cancelled) return;
        setState(s);
        setDoses(d);
        setSymptoms(sy);
      } catch (err: any) {
        if (!signal?.cancelled) {
          show(err.message || 'Kon allergenen niet laden.', 'error');
        }
      } finally {
        if (!signal?.cancelled) setLoading(false);
      }
    },
    [childId, navigation, show]
  );

  useFocusEffect(
    useCallback(() => {
      const signal = { cancelled: false };
      setLoading(true);
      void loadAll(signal);
      return () => {
        signal.cancelled = true;
      };
    }, [loadAll])
  );

  const ctx: AllergenContext | null = useMemo(() => {
    if (!child) return null;
    return buildAllergenContext(doses, state, ageInMonths(child.birthdate));
  }, [child, state, doses]);

  /* Volgende-stap suggestie (spiegelt getNextDoseSuggestion uit website). */
  const nextUp = useMemo(() => {
    if (!ctx || ctx.paused) return null;
    const ordered = [...ALLERGEN_FLOW].sort((a, b) => a.order - b.order);
    for (const a of ordered) {
      if (ctx.knownAllergies.includes(a.key)) continue;
      if (ctx.completed.includes(a.key)) continue; // bevat ook pre_introduced
      if (ctx.excludedKeys.includes(a.key)) continue;
      const total = doses.filter(d => d.allergen_key === a.key).length;
      if (total >= 3) continue;
      return { allergen: a, doseNumber: (total + 1) as 1 | 2 | 3 };
    }
    return null;
  }, [ctx, doses]);

  const ordered = useMemo(
    () => [...ALLERGEN_FLOW].sort((a, b) => a.order - b.order),
    []
  );

  const goToDoseForm = (key: string) =>
    navigation.navigate('DoseForm', { childId, allergenKey: key });

  const goToEditDose = (key: string, doseId: string) =>
    navigation.navigate('DoseForm', { childId, allergenKey: key, doseId });

  const goToEditSymptom = (symptomId: string) =>
    navigation.navigate('SymptomForm', { childId, symptomId });

  /* ============================================
     Pauze-flow handlers — paritair met
     `advancePauseStep` / `handleAllergyConfirmed` / `handleAllergyDenied`
     in `js/components/allergenen.js`.
  ============================================ */
  const allergenState = state?.allergen_state;
  const pauseStep = Math.min(
    Math.max(allergenState?.paused_step ?? 0, 1),
    3
  ) as 1 | 2 | 3;
  const pauseType: 'twijfel' | 'ernstig' =
    allergenState?.paused_type === 'ernstig' ? 'ernstig' : 'twijfel';
  const pausedAllergenKey = allergenState?.paused_allergen ?? null;
  const pausedAllergen = pausedAllergenKey
    ? ALLERGEN_FLOW.find(a => a.key === pausedAllergenKey)
    : null;
  const pausedAllergenLabel = pausedAllergen
    ? pausedAllergen.label
    : pausedAllergenKey ?? 'het bewuste allergeen';

  const advancePauseStep = useCallback(async () => {
    if (!state) return;
    setPauseBusy(true);
    try {
      const current = state.allergen_state ?? ({} as EhState['allergen_state']);
      const nextStep = (current.paused_step ?? 1) + 1;
      const updated = await patchEhState(childId, {
        allergen_state: { ...current, paused_step: nextStep },
      });
      setState(updated);
    } catch (err: any) {
      show(err.message || 'Opslaan mislukt.', 'error');
    } finally {
      setPauseBusy(false);
    }
  }, [childId, state, show]);

  const handleAllergyConfirmed = useCallback(async () => {
    if (!state || !child || !pausedAllergenKey) return;
    setPauseBusy(true);
    try {
      const current = state.allergen_state ?? ({} as EhState['allergen_state']);
      const newKnown = Array.from(
        new Set([...(current.known_allergies ?? []), pausedAllergenKey])
      );
      const isErnstig = pauseType === 'ernstig';
      const updated = await patchEhState(childId, {
        allergen_state: {
          ...current,
          paused: false,
          paused_type: null,
          paused_step: 0,
          known_allergies: newKnown,
          arts_toezicht: isErnstig || !!current.arts_toezicht,
        },
      });
      setState(updated);

      /* Sync naar kind-profiel (best-effort). */
      const currentChildAllergies = child.known_allergies ?? [];
      const newChildAllergies = Array.from(
        new Set([...currentChildAllergies, pausedAllergenKey])
      );
      try {
        const updatedChild = await updateChild(child.id, {
          known_allergies: newChildAllergies,
        });
        setChild(updatedChild);
      } catch (profileErr) {
        console.warn('Allergie sync naar profiel mislukt:', profileErr);
      }

      show(
        `${pausedAllergen?.label ?? pausedAllergenKey} gemarkeerd als allergie.`,
        'success'
      );
    } catch (err: any) {
      show(err.message || 'Opslaan mislukt.', 'error');
    } finally {
      setPauseBusy(false);
    }
  }, [
    childId,
    child,
    state,
    pauseType,
    pausedAllergenKey,
    pausedAllergen,
    show,
  ]);

  const handleAllergyDenied = useCallback(async () => {
    if (!state) return;
    setPauseBusy(true);
    try {
      const current = state.allergen_state ?? ({} as EhState['allergen_state']);
      const isErnstig = pauseType === 'ernstig';
      const updated = await patchEhState(childId, {
        allergen_state: {
          ...current,
          paused: false,
          paused_type: null,
          paused_step: 0,
          arts_toezicht: isErnstig || !!current.arts_toezicht,
        },
      });
      setState(updated);
    } catch (err: any) {
      show(err.message || 'Opslaan mislukt.', 'error');
    } finally {
      setPauseBusy(false);
    }
  }, [childId, state, pauseType, show]);

  /* ============================================
     Setup-flow handler — paritair met `finalize()` in `renderSetup()` op
     `js/components/allergenen.js`. Slaat `pre_introduced`, `setup_done` en
     `started` op via PATCH /api/eerste-hapjes/state.
  ============================================ */
  const handleSetupFinalize = useCallback(
    async (preIntroduced: string[]) => {
      if (!state) return;
      setSetupBusy(true);
      try {
        const current =
          state.allergen_state ?? ({} as EhState['allergen_state']);
        const updated = await patchEhState(childId, {
          allergen_state: {
            ...current,
            pre_introduced: preIntroduced,
            setup_done: true,
            started: true,
          },
        });
        setState(updated);
        show(
          preIntroduced.length > 0
            ? `${preIntroduced.length} allergen${
                preIntroduced.length === 1 ? '' : 'en'
              } gemarkeerd als reeds geïntroduceerd.`
            : 'Setup voltooid.',
          'success'
        );
      } catch (err: any) {
        show(err.message || 'Opslaan mislukt.', 'error');
      } finally {
        setSetupBusy(false);
      }
    },
    [childId, state, show]
  );

  /* ============================================
     Welcome-flow handler — paritair met start-flow in `renderWelcome()` op
     `js/components/allergenen.js`. Slaat `started: true` op.
  ============================================ */
  const handleStartFlow = useCallback(async () => {
    if (!state) return;
    setWelcomeBusy(true);
    try {
      const current =
        state.allergen_state ?? ({} as EhState['allergen_state']);
      const updated = await patchEhState(childId, {
        allergen_state: { ...current, started: true },
      });
      setState(updated);
    } catch (err: any) {
      show(err.message || 'Starten mislukt.', 'error');
    } finally {
      setWelcomeBusy(false);
    }
  }, [childId, state, show]);

  /* ============================================
     Re-enable — paritair met `renderDisabled()`'s "Toch volgen"-knop op de
     website. Zet `opted_out: false` + `started: false` zodat de gebruiker
     terug bij het welkomscherm start.
  ============================================ */
  const handleReenableFlow = useCallback(async () => {
    if (!state) return;
    setReenableBusy(true);
    try {
      const current =
        state.allergen_state ?? ({} as EhState['allergen_state']);
      const updated = await patchEhState(childId, {
        allergen_state: { ...current, opted_out: false, started: false },
      });
      setState(updated);
    } catch (err: any) {
      show(err.message || 'Activeren mislukt.', 'error');
    } finally {
      setReenableBusy(false);
    }
  }, [childId, state, show]);

  /* ============================================
     Exclude-toggle — paritair met `toggleAllergenExcluded()` in
     `js/components/allergenen.js`. Voegt het allergeen toe aan
     `excluded_keys` of verwijdert het weer.
  ============================================ */
  const handleToggleExclude = useCallback(
    async (allergenKey: string) => {
      if (!state) return;
      setExcludeBusyKey(allergenKey);
      try {
        const current =
          state.allergen_state ?? ({} as EhState['allergen_state']);
        const excluded = new Set(current.excluded_keys ?? []);
        const wasExcluded = excluded.has(allergenKey);
        if (wasExcluded) excluded.delete(allergenKey);
        else excluded.add(allergenKey);
        const updated = await patchEhState(childId, {
          allergen_state: { ...current, excluded_keys: [...excluded] },
        });
        setState(updated);
      } catch (err: any) {
        show(err.message || 'Opslaan mislukt.', 'error');
      } finally {
        setExcludeBusyKey(null);
      }
    },
    [childId, state, show]
  );

  /* Functie uitgeschakeld (opted_out) — heeft voorrang op alle andere
     stages, paritair met `renderStage()` in `js/components/allergenen.js`. */
  const needsDisabled = !!state && !!allergenState?.opted_out;
  const isPaused =
    !needsDisabled && !!ctx?.paused && (allergenState?.paused_step ?? 0) > 0;
  const needsWelcome =
    !!state && !needsDisabled && !allergenState?.started && !isPaused;
  const needsSetup =
    !!state &&
    !needsDisabled &&
    !!allergenState?.started &&
    !allergenState?.setup_done &&
    !isPaused;
  const showArtsWarn = useMemo(
    () => shouldShowArtsWarning(doses, symptoms),
    [doses, symptoms]
  );
  const showArtsToezicht = !!allergenState?.arts_toezicht;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <ChevronBack onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Allergenen-introductie</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading || !child || !ctx ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Intro-tekst paritair met `.allergenen-intro` op de website. */}
          <Text style={styles.introText}>
            Volg de 9 allergenen, telkens 3 introducties met een rustpauze
            van minstens 2 dagen ertussen. Bekende allergieën uit het profiel
            zijn automatisch gemarkeerd.
          </Text>

          {/* Kind-info met inline "Symptoom loggen"-knop (groene outline,
             paritair met `.btn-outline.btn-sm` op de website).
             v2.8.9: tijdens een pauze-flow (twijfel / ernstige reactie)
             verbergen we de "Symptoom loggen"-knop tot de gebruiker alle
             waarschuwingsstappen heeft doorlopen. */}
          <View style={styles.childRow}>
            <View style={styles.childInfo}>
              <Text style={styles.childName}>{child.name}</Text>
              <Text style={styles.childAge}>{formatAge(child.birthdate)}</Text>
            </View>
            {!isPaused && !needsDisabled && (
              <Pressable
                onPress={() =>
                  navigation.navigate('SymptomForm', { childId: child.id })
                }
                style={({ pressed }) => [
                  styles.symptomLogBtn,
                  pressed && styles.symptomLogBtnPressed,
                ]}
                accessibilityLabel="Symptoom loggen"
              >
                <Feather name="plus" size={13} color={colors.secondaryDark} />
                <Text style={styles.symptomLogBtnText}>Symptoom loggen</Text>
              </Pressable>
            )}
          </View>

          {/* Hoeveelheden-box — verborgen tijdens pauze-flow + wanneer de
             functie is uitgeschakeld (v2.8.9). */}
          {!isPaused && !needsDisabled && <HoeveelhedenBox />}

          {/* Arts-warning banner — paritair met `.allergenen-arts-warn` in
             de website. Toont bij recente ernstige reactie/heftig symptoom. */}
          {showArtsWarn && (
            <View style={styles.artsWarn}>
              <Text style={styles.artsWarnStrong}>
                ⚠️ Er is recent een ernstige reactie of heftig symptoom
                gelogd voor je kindje.
              </Text>
              <Text style={styles.artsWarnText}>
                Pril Leven geeft geen medisch advies, neem contact op met je
                huisarts, kinderarts of kinderdiëtiste voor verdere
                begeleiding.
              </Text>
            </View>
          )}

          {needsDisabled ? (
            /* Functie uitgeschakeld — paritair met `renderDisabled()`. */
            <DisabledCard
              childName={child.name}
              busy={reenableBusy}
              onReenable={handleReenableFlow}
            />
          ) : isPaused ? (
            /* Pauze-flow vervangt de allergenen-grid volledig. */
            <PauseFlowCard
              childName={child.name}
              pauseType={pauseType}
              step={pauseStep}
              allergenLabel={pausedAllergenLabel}
              busy={pauseBusy}
              onAdvance={advancePauseStep}
              onAllergyConfirmed={handleAllergyConfirmed}
              onAllergyDenied={handleAllergyDenied}
            />
          ) : needsWelcome ? (
            /* Welcome-flow: intro + "Start met introduceren" — paritair met website. */
            <WelcomeCard
              childName={child.name}
              busy={welcomeBusy}
              onStart={handleStartFlow}
            />
          ) : needsSetup ? (
            /* Setup-flow: "Reeds geïntroduceerd?" — paritair met website. */
            <SetupCard
              childName={child.name}
              knownAllergies={ctx.knownAllergies}
              busy={setupBusy}
              onFinalize={handleSetupFinalize}
            />
          ) : (
            <>
              {/* Arts-toezicht banner — paritair met `.allergenen-arts-toezicht-banner`. */}
              {showArtsToezicht && (
                <View style={styles.artsToezichtBanner}>
                  <Text style={styles.artsToezichtIcon}>🩺</Text>
                  <View style={styles.artsToezichtBody}>
                    <Text style={styles.artsToezichtTitle}>
                      Introductie onder medisch toezicht
                    </Text>
                    <Text style={styles.artsToezichtText}>
                      Ga enkel verder met het introduceren van allergenen
                      onder toezicht van je arts. Sla allergenen over via de
                      knop per allergeen.
                    </Text>
                  </View>
                </View>
              )}

              {/* Volgende stap-banner */}
              {nextUp && (
                <NextUpBanner
                  allergen={nextUp.allergen}
                  doseNumber={nextUp.doseNumber}
                  onPress={() => goToDoseForm(nextUp.allergen.key)}
                />
              )}
              {!nextUp && ctx.completed.length > 0 && (
                <View style={styles.nextUpDone}>
                  <Text style={styles.nextUpDoneText}>
                    🎉 Alle allergenen zijn afgewerkt. Je hoeft niets meer te
                    doen — bekijk de historiek per tegel hieronder.
                  </Text>
                </View>
              )}

              {/* Allergenen-lijst */}
              <Text style={styles.listLabel}>
                Tik op een allergeen voor info en om een introductie te
                registreren.
              </Text>
              <View style={styles.list}>
                {ordered.map(item => {
                  const rawStatus = getAllergenStatus(item.key, ctx);
                  const isExcluded = ctx.excludedKeys.includes(item.key);
                  /* Spiegel van regel 855 in `js/components/allergenen.js`:
                     `excluded` overschrijft rawStatus, behalve als
                     veilig/allergisch al vaststaan. */
                  const status: AllergenStatus =
                    isExcluded &&
                    rawStatus !== 'veilig' &&
                    rawStatus !== 'allergisch'
                      ? 'excluded'
                      : rawStatus;
                  /* `showExcludeBtn` gebruikt de rawStatus, paritair met
                     regel 877 op de website. */
                  const showExcludeBtn =
                    showArtsToezicht &&
                    rawStatus !== 'veilig' &&
                    rawStatus !== 'allergisch';
                  const successCount = successfulDoseCount(doses, item.key);
                  const dosesForKey = doses
                    .filter(d => d.allergen_key === item.key)
                    .sort((a, b) => a.dose_number - b.dose_number);
                  const symptomsForKey = symptoms
                    .filter(s => s.linked_allergen_key === item.key)
                    .sort(
                      (a, b) =>
                        new Date(b.occurred_at).getTime() -
                        new Date(a.occurred_at).getTime()
                    );
                  return (
                    <AllergenCard
                      key={item.key}
                      allergen={item}
                      status={status}
                      successCount={successCount}
                      totalDoses={dosesForKey.length}
                      open={openKey === item.key}
                      doses={dosesForKey}
                      symptoms={symptomsForKey}
                      onToggle={() => {
                        easeAccordion();
                        setOpenKey(k => (k === item.key ? null : item.key));
                      }}
                      onEditDose={doseId => goToEditDose(item.key, doseId)}
                      onEditSymptom={goToEditSymptom}
                      showExcludeBtn={showExcludeBtn}
                      isExcluded={isExcluded}
                      excludeBusy={excludeBusyKey === item.key}
                      onToggleExclude={() => handleToggleExclude(item.key)}
                    />
                  );
                })}
              </View>

            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
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
  loadingBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  /* `.allergenen-intro` op de website (color-dark-light, .95rem,
     line-height 1.5). */
  introText: {
    fontSize: 14,
    color: colors.darkLight,
    lineHeight: 21,
    marginBottom: spacing.md,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  childInfo: {
    flex: 1,
    minWidth: 0,
  },
  childName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.dark,
  },
  childAge: {
    fontSize: 13,
    color: colors.gray,
    marginTop: 2,
  },

  /* Hoeveelheden-box */
  hoeveelheden: {
    backgroundColor: '#fdf7e4',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#f5e8b8',
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  hoeveelhedenHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  hoeveelhedenTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.darkLight,
  },
  hoeveelhedenBody: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: 4,
  },
  hoeveelhedenItem: {
    fontSize: 13,
    color: colors.dark,
    lineHeight: 19,
  },
  bold: {
    fontWeight: '700',
  },

  /* Algemene banners */
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  bannerWarning: {
    backgroundColor: '#fcf3cf',
  },
  bannerInfo: {
    backgroundColor: '#e7f3fb',
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.dark,
    lineHeight: 18,
  },

  /* Arts-warning (recent ernstige reactie / heftig symptoom) — geel/oranje,
     paritair met `.allergenen-arts-warn` op de website. */
  artsWarn: {
    backgroundColor: '#fff4e5',
    borderWidth: 1,
    borderColor: '#f0b97a',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  artsWarnStrong: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b3a00',
    marginBottom: 4,
    lineHeight: 18,
  },
  artsWarnText: {
    fontSize: 13,
    color: '#6b3a00',
    lineHeight: 18,
  },

  /* Arts-toezicht banner (na bevestigde ernstige allergie). */
  artsToezichtBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#fff8e1',
    borderWidth: 1,
    borderColor: '#e9c46a',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  artsToezichtIcon: {
    fontSize: 22,
    marginTop: 1,
  },
  artsToezichtBody: {
    flex: 1,
  },
  artsToezichtTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b3a00',
    marginBottom: 2,
  },
  artsToezichtText: {
    fontSize: 12,
    color: '#6b3a00',
    lineHeight: 17,
  },

  /* Pause-flow card — paritair met `.allergenen-pause-flow`. */
  pauseFlowCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.light,
    borderRadius: radius.md,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    alignItems: 'center',
    ...shadows.md,
  },
  pauseFlowCardErnstig: {
    borderColor: colors.danger,
    backgroundColor: '#fff5f5',
  },
  pauseFlowIcon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  pauseFlowTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  pauseFlowText: {
    fontSize: 14,
    color: colors.dark,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 6,
  },
  pauseFlowSub: {
    fontSize: 13,
    color: colors.gray,
    textAlign: 'center',
    marginTop: 4,
  },
  pauseFlowActions: {
    marginTop: spacing.lg,
    width: '100%',
    alignItems: 'center',
  },
  pauseFlowActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  pauseFlowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.sm,
    minWidth: 140,
  },
  pauseFlowBtnPrimary: {
    backgroundColor: colors.primary,
  },
  pauseFlowBtnDanger: {
    backgroundColor: colors.danger,
  },
  pauseFlowBtnTextPrimary: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  btnDisabled: {
    opacity: 0.55,
  },

  /* Volgende stap-banner */
  nextUp: {
    position: 'relative',
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    backgroundColor: '#eef3e8',
    minHeight: 130,
    ...shadows.sm,
  },
  nextUpBg: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '70%',
  },
  nextUpGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  nextUpContent: {
    padding: spacing.md,
    width: '70%',
  },
  nextUpLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.secondaryDark,
    letterSpacing: 1,
    marginBottom: 2,
  },
  nextUpTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: 4,
  },
  nextUpSub: {
    fontSize: 12,
    color: colors.darkLight,
    lineHeight: 16,
    marginBottom: spacing.sm,
  },
  nextUpCta: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  nextUpCtaDisabled: {
    backgroundColor: colors.grayLight,
  },
  nextUpCtaText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  nextUpDone: {
    backgroundColor: '#eaf3ed',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  nextUpDoneText: {
    fontSize: 13,
    color: colors.dark,
    lineHeight: 18,
  },

  /* Allergen-cards */
  listLabel: {
    fontSize: 13,
    color: colors.gray,
    marginBottom: spacing.sm,
  },
  list: {
    gap: spacing.md,
  },
  card: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: '#eef3e8',
    borderWidth: 1,
    borderColor: colors.grayLight,
    ...shadows.sm,
  },
  cardHeader: {
    width: '100%',
    height: 96,
    justifyContent: 'center',
  },
  cardHeaderImg: {
    // borderRadius lukt niet op overflow-hidden parent; we laten image plat
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  labelChip: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
  },
  labelChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.dark,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusChip: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  caretChip: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: spacing.md,
    backgroundColor: '#eef3e8',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    gap: spacing.sm,
  },
  cardBodyHint: {
    fontSize: 12,
    color: colors.darkLight,
    fontStyle: 'italic',
    marginTop: 2,
  },
  italic: {
    fontStyle: 'italic',
  },

  /* Content-secties (Gepureerde voeding / Stukjes) */
  contentSection: {
    marginBottom: spacing.xs,
  },
  contentTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: 4,
  },
  contentBullet: {
    fontSize: 13,
    color: colors.dark,
    lineHeight: 19,
    marginLeft: 4,
  },

  /* Log-secties (introducties / reacties) */
  logSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  logTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: spacing.xs,
  },
  /* Dose-rij (paritair met `.allergenen-dose` op de website) */
  doseRow: {
    backgroundColor: colors.bg,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  doseRowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  doseRowNum: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  doseRowDate: {
    flex: 1,
    fontSize: 12,
    color: colors.darkLight,
  },
  doseRowNotes: {
    fontSize: 12,
    color: colors.darkLight,
    fontStyle: 'italic',
    marginTop: 2,
  },
  /* Symptoom-rij (paritair met `.allergenen-symptom` op de website) */
  symptomRow: {
    borderLeftWidth: 4,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  symptomRowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  symptomRowSeverity: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.dark,
  },
  symptomRowDate: {
    flex: 1,
    fontSize: 11,
    color: colors.darkLight,
  },
  symptomRowNotes: {
    fontSize: 12,
    color: colors.darkLight,
    fontStyle: 'italic',
    marginTop: 4,
  },
  editBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.6,
  },
  editBtnPressed: {
    opacity: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  logProgress: {
    fontSize: 12,
    color: colors.gray,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  logChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  logChip: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  logChipText: {
    fontSize: 11,
    color: colors.darkLight,
  },

  /* "Symptoom loggen"-knop — kleine groene outline, paritair met
     `.btn.btn-outline.btn-sm` op de website (sage-groen). */
  symptomLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.secondaryDark,
    backgroundColor: 'transparent',
  },
  symptomLogBtnPressed: {
    backgroundColor: colors.secondaryDark,
  },
  symptomLogBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.secondaryDark,
  },

  /* "Overslaan"/"Opnemen"-toggle in arts-toezicht modus, paritair met
     `.allergenen-exclude-btn` op de website. v2.9.1: tekstknop op de
     foto-header zelf (bottom-right), zodat de foto over de hele gesloten
     tegel doorloopt en de knop niet tegen de onderrand plakt. */
  excludeBtn: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.sm,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.grayLight,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  excludeBtnPressed: {
    backgroundColor: colors.light,
  },
  excludeBtnDisabled: {
    opacity: 0.5,
  },
  excludeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.darkLight,
  },

  footnote: {
    fontSize: 11,
    color: colors.gray,
    marginTop: spacing.xl,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  /* Welcome-card ("Klaar om allergenen te introduceren?") — paritair met
     `.allergenen-welcome-card` op de website. */
  welcomeCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#e6e2d8',
    borderRadius: 16,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  welcomeIcon: {
    fontSize: 38,
    marginBottom: spacing.xs,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  welcomeBody: {
    fontSize: 14,
    color: colors.darkLight,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  welcomeBtn: {
    marginTop: spacing.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
  },
  welcomeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },

  /* Setup-card ("Reeds geïntroduceerd?") — paritair met
     `.allergenen-setup-card` op de website. */
  setupCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.light,
    borderRadius: radius.md,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  setupTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: spacing.sm,
  },
  setupBody: {
    fontSize: 13,
    color: colors.darkLight,
    lineHeight: 19,
    marginBottom: spacing.lg,
  },
  setupEmpty: {
    fontSize: 13,
    color: colors.gray,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  setupList: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  setupItem: {
    position: 'relative',
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e6e2d8',
    backgroundColor: '#fafaf6',
    overflow: 'hidden',
  },
  setupItemBg: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '70%',
  },
  setupItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  setupItemChecked: {
    borderColor: colors.primary,
  },
  setupItemPressed: {
    opacity: 0.85,
  },
  setupBox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.gray,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  setupBoxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  setupItemLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
  setupActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  setupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    minWidth: 130,
  },
  setupBtnPrimary: {
    backgroundColor: colors.primary,
  },
  setupBtnPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  setupBtnOutline: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  setupBtnOutlineText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },

  btnPressed: {
    opacity: 0.65,
  },
});
