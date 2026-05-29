/**
 * LANDING SCREEN
 *
 * Eerste scherm na login. Toont 4 grote tegels met achtergrondfoto:
 *   1. Receptenboek & Weekschema  → MainTabs (bestaande app)
 *   2. HapjesHeld 2.0             → Chat met RAG bot
 *   3. Allergenen-introductie     → AllergenenChildren (kies kind)
 *   4. Learnings                  → Learnings (documenten/blogs/video's)
 *
 * Klik-effect: tegel krimpt licht bij tap en veert terug (spring animation).
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ImageBackground,
  ImageResizeMode,
  Pressable,
  Animated,
  ImageSourcePropType,
} from 'react-native';
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

/* ----------------------------------------
   AnimatedTile — spring scale effect bij press
---------------------------------------- */
interface AnimatedTileProps {
  image: ImageSourcePropType;
  overlayColor: string;
  title: string;
  badge?: string;
  onPress: () => void;
  /** Optional resize mode override (default = 'cover'). */
  imageResizeMode?: ImageResizeMode;
  /** Background tint behind the image (zichtbaar bij 'contain'). */
  bgColor?: string;
}

function AnimatedTile({
  image,
  overlayColor,
  title,
  badge,
  onPress,
  imageResizeMode = 'cover',
  bgColor,
}: AnimatedTileProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();

  const pressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 18,
      bounciness: 10,
    }).start();

  return (
    <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}>
      <Animated.View
        style={[
          styles.tile,
          bgColor ? { backgroundColor: bgColor } : null,
          { transform: [{ scale }] },
        ]}
      >
        <ImageBackground
          source={image}
          style={styles.tileBg}
          imageStyle={styles.tileImage}
          resizeMode={imageResizeMode}
        >
          <View style={[styles.overlay, { backgroundColor: overlayColor }]} />
          <View style={styles.tileContent}>
            <Text style={styles.tileTitle}>{title}</Text>
          </View>
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </ImageBackground>
      </Animated.View>
    </Pressable>
  );
}

/* ----------------------------------------
   LandingScreen
---------------------------------------- */
export function LandingScreen({ navigation }: Props) {
  const { user } = useUser();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
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

        {/* Titel */}
        <Text style={styles.title}>Welkom bij Pril Leven</Text>
        <Text style={styles.subtitle}>Kies wat je wil doen</Text>

        {/* Tegels */}
        <AnimatedTile
          image={IMG_RECEPTEN}
          overlayColor="rgba(0, 0, 0, 0.45)"
          title="Receptenboek & Weekschema"
          onPress={() => navigation.navigate('Main')}
        />

        <AnimatedTile
          image={IMG_HAPJESHELD}
          overlayColor="rgba(130, 190, 147, 0.80)"
          title="HapjesHeld 2.0"
          badge="NIEUW"
          onPress={() => navigation.navigate('HapjesHeld')}
        />

        <AnimatedTile
          image={IMG_LEARNINGS}
          overlayColor="rgba(190, 118, 78, 0.55)"
          title="Learnings"
          badge="NIEUW"
          onPress={() => navigation.navigate('Learnings')}
        />

        <AnimatedTile
          image={IMG_ALLERGENEN}
          overlayColor="rgba(201, 137, 102, 0.55)"
          title="Allergenen-introductie"
          badge="NIEUW"
          onPress={() => navigation.navigate('AllergenenChildren')}
        />
      </ScrollView>
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    color: colors.gray,
    marginBottom: spacing.xl,
  },
  tile: {
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    ...shadows.md,
  },
  tileBg: {
    minHeight: 140,
    justifyContent: 'flex-end',
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
});
