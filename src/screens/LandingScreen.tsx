/**
 * LANDING SCREEN
 *
 * Eerste scherm na login (tab "Functies"). Toont 4 grote tegels met
 * achtergrondfoto:
 *   1. Receptenboek & Weekschema  → Main (bestaande app)
 *   2. HapjesHeld 2.0             → Chat met RAG bot
 *   3. Learnings                  → Learnings (documenten/blogs/video's)
 *   4. Allergenen-introductie     → AllergenenChildren (kies kind)
 *
 * Tegel-tekst staat links-midden (verticaal gecentreerd).
 *
 * Herordenen (iPhone-stijl): lang drukken op een tegel zet de "verplaats"-
 * modus aan — alle tegels wiebelen en je kunt ze slepen om de volgorde te
 * wijzigen. Een "Klaar"-knop sluit de modus. De volgorde wordt per gebruiker
 * bewaard in AsyncStorage (key `receptenboek_landing_tile_order_<email>`) en
 * is enkel lokaal (de website heeft deze functie niet).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ImageBackground,
  Pressable,
  ImageSourcePropType,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import DraggableFlatList, {
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { useUser } from '../context/UserContext';
import { AvatarButton } from '../components/AvatarButton';
import { getCommunityProfile } from '../services';
import type {
  RootStackParamList,
  LandingTabParamList,
} from '../navigation/types';

/* Functies-tab binnen LandingTabs, genest in de RootStack. Composite
   zodat navigation.navigate('Main' | 'HapjesHeld' | 'Profile' | ...)
   naar de RootStack bubbelt. */
type Props = CompositeScreenProps<
  BottomTabScreenProps<LandingTabParamList, 'Functies'>,
  NativeStackScreenProps<RootStackParamList>
>;

const IMG_RECEPTEN = require('../../assets/landing-recepten.jpeg');
const IMG_HAPJESHELD = require('../../assets/landing-hapjesheld.png');
const IMG_ALLERGENEN = require('../../assets/landing-allergenen.png');
const IMG_LEARNINGS = require('../../assets/landing-learnings.png');

const ORDER_KEY_PREFIX = 'receptenboek_landing_tile_order_';

/* ----------------------------------------
   Tegel-definities (stabiele keys voor de bewaarde volgorde)
---------------------------------------- */
type TileKey = 'recepten' | 'hapjesheld' | 'learnings' | 'allergenen';

interface TileDef {
  key: TileKey;
  image: ImageSourcePropType;
  overlayColor: string;
  title: string;
  badge?: string;
}

const TILES: TileDef[] = [
  {
    key: 'recepten',
    image: IMG_RECEPTEN,
    overlayColor: 'rgba(0, 0, 0, 0.45)',
    title: 'Receptenboek & Weekschema',
  },
  {
    key: 'hapjesheld',
    image: IMG_HAPJESHELD,
    overlayColor: 'rgba(130, 190, 147, 0.80)',
    title: 'HapjesHeld 2.0',
    badge: 'NIEUW',
  },
  {
    key: 'learnings',
    image: IMG_LEARNINGS,
    overlayColor: 'rgba(190, 118, 78, 0.55)',
    title: 'Learnings',
    badge: 'NIEUW',
  },
  {
    key: 'allergenen',
    image: IMG_ALLERGENEN,
    overlayColor: 'rgba(201, 137, 102, 0.55)',
    title: 'Allergenen-introductie',
    badge: 'NIEUW',
  },
];

/** Herschikt de tegels volgens de bewaarde key-volgorde; onbekende of nieuwe
    tegels worden achteraan toegevoegd zodat updates niet "verdwijnen". */
function applyOrder(order: string[] | null): TileDef[] {
  if (!order || order.length === 0) return TILES;
  const map = new Map<string, TileDef>(TILES.map(t => [t.key, t]));
  const result: TileDef[] = [];
  for (const key of order) {
    const tile = map.get(key);
    if (tile) {
      result.push(tile);
      map.delete(key);
    }
  }
  for (const tile of map.values()) result.push(tile);
  return result;
}

/* ----------------------------------------
   DraggableTile — wiebel in edit-modus + spring bij press
---------------------------------------- */
interface DraggableTileProps {
  item: TileDef;
  drag: () => void;
  isActive: boolean;
  editing: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

function DraggableTile({
  item,
  drag,
  isActive,
  editing,
  onPress,
  onLongPress,
}: DraggableTileProps) {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  /* Wiebel-loop aan/uit op basis van edit-modus. */
  useEffect(() => {
    if (editing) {
      rotation.value = withRepeat(
        withSequence(
          withTiming(-1.3, { duration: 100 }),
          withTiming(1.3, { duration: 100 })
        ),
        -1,
        true
      );
    } else {
      cancelAnimation(rotation);
      rotation.value = withTiming(0, { duration: 120 });
    }
  }, [editing, rotation]);

  /* Iets uitvergroten terwijl je de tegel sleept. */
  useEffect(() => {
    scale.value = withTiming(isActive ? 1.04 : 1, { duration: 120 });
  }, [isActive, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { rotateZ: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={220}
        onPressIn={() => {
          if (!editing) scale.value = withTiming(0.97, { duration: 80 });
        }}
        onPressOut={() => {
          if (!editing) scale.value = withTiming(1, { duration: 120 });
        }}
      >
        <View style={[styles.tile, isActive && styles.tileActive]}>
          <ImageBackground
            source={item.image}
            style={styles.tileBg}
            imageStyle={styles.tileImage}
            resizeMode="cover"
          >
            <View
              style={[styles.overlay, { backgroundColor: item.overlayColor }]}
            />
            <View style={styles.tileContent}>
              <Text style={styles.tileTitle}>{item.title}</Text>
            </View>
            {item.badge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            ) : null}
            {editing ? (
              <View style={styles.moveHandle}>
                <Feather name="move" size={16} color={colors.dark} />
              </View>
            ) : null}
          </ImageBackground>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/* ----------------------------------------
   LandingScreen
---------------------------------------- */
export function LandingScreen({ navigation }: Props) {
  const { user } = useUser();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [data, setData] = useState<TileDef[]>(TILES);
  const [editing, setEditing] = useState(false);
  const loadedOrderFor = useRef<string | null>(null);

  /* Bewaarde volgorde laden zodra we de ingelogde gebruiker kennen. */
  useEffect(() => {
    if (!user || loadedOrderFor.current === user) return;
    loadedOrderFor.current = user;
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ORDER_KEY_PREFIX + user);
        const order = raw ? (JSON.parse(raw) as string[]) : null;
        if (!cancelled) setData(applyOrder(Array.isArray(order) ? order : null));
      } catch {
        if (!cancelled) setData(TILES);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  /* Bij elke focus (incl. terugkeer van ProfileScreen) refresh
     de community-avatar zodat een upload zichtbaar wordt. Stille
     fout-afhandeling: bij failure tonen we initialen. */
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const profile = await getCommunityProfile();
          if (!cancelled) setAvatarUrl(profile?.avatar_url ?? null);
        } catch {
          if (!cancelled) setAvatarUrl(null);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const navigateFor = useCallback(
    (key: TileKey) => {
      switch (key) {
        case 'recepten':
          navigation.navigate('Main');
          break;
        case 'hapjesheld':
          navigation.navigate('HapjesHeld');
          break;
        case 'learnings':
          navigation.navigate('Learnings');
          break;
        case 'allergenen':
          navigation.navigate('AllergenenChildren');
          break;
      }
    },
    [navigation]
  );

  /* Volgorde bewaren na een sleep-actie. */
  const persistOrder = useCallback(
    (next: TileDef[]) => {
      if (!user) return;
      AsyncStorage.setItem(
        ORDER_KEY_PREFIX + user,
        JSON.stringify(next.map(t => t.key))
      ).catch(() => {
        /* Stille fout: volgorde bewaren is niet kritisch. */
      });
    },
    [user]
  );

  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<TileDef>) => (
      <DraggableTile
        item={item}
        drag={drag}
        isActive={isActive}
        editing={editing}
        onPress={() => {
          /* In edit-modus doet tikken niets (zoals op de iPhone). */
          if (!editing) navigateFor(item.key);
        }}
        onLongPress={() => {
          /* Lang drukken: edit-modus aan + meteen oppakken om te slepen. */
          if (!editing) setEditing(true);
          drag();
        }}
      />
    ),
    [editing, navigateFor]
  );

  const header = (
    <View>
      {/* Header — ingelogd als + avatar (opent Profile) */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Text style={styles.userLabel}>INGELOGD ALS</Text>
          <Text style={styles.userEmail} numberOfLines={1}>
            👤 {user}
          </Text>
        </View>
        <AvatarButton
          email={user}
          avatarUrl={avatarUrl}
          onPress={() => navigation.navigate('Profile')}
        />
      </View>

      {/* Titel + optionele Klaar-knop in edit-modus */}
      <View style={styles.titleRow}>
        <View style={styles.titleCol}>
          <Text style={styles.title}>Welkom bij Pril Leven</Text>
          <Text style={styles.subtitle}>
            {editing ? 'Sleep de tegels in de gewenste volgorde' : 'Kies wat je wil doen'}
          </Text>
        </View>
        {editing ? (
          <Pressable
            onPress={() => setEditing(false)}
            style={({ pressed }) => [styles.doneBtn, pressed && styles.pressed]}
            hitSlop={8}
          >
            <Text style={styles.doneBtnText}>Klaar</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <DraggableFlatList
        data={data}
        keyExtractor={item => item.key}
        renderItem={renderItem}
        onDragEnd={({ data: next }) => {
          setData(next);
          persistOrder(next);
        }}
        activationDistance={12}
        ListHeaderComponent={header}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
  },
  userInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  userLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gray,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  titleCol: {
    flex: 1,
    marginRight: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    color: colors.gray,
  },
  doneBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    marginTop: 4,
  },
  doneBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  pressed: {
    opacity: 0.7,
  },
  tile: {
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    ...shadows.md,
  },
  tileActive: {
    ...shadows.lg,
  },
  tileBg: {
    minHeight: 140,
    justifyContent: 'flex-start',
  },
  tileImage: {
    borderRadius: radius.lg,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  tileContent: {
    padding: spacing.lg,
  },
  tileTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  badge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.secondaryDark,
    letterSpacing: 0.5,
  },
  moveHandle: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
