/**
 * LANDING SCREEN
 *
 * Eerste scherm na login. Toont 2 grote tegels met achtergrondfoto:
 *   1. Receptenboek & Weekschema  → MainTabs (bestaande app)
 *   2. HapjesHeld 2.0             → Chat met RAG bot
 *
 * Klik-effect: tegel krimpt licht bij tap en veert terug (spring animation).
 */

import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ImageBackground,
  Pressable,
  Animated,
  ImageSourcePropType,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { useUser } from '../context/UserContext';
import { AvatarButton } from '../components/AvatarButton';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Landing'>;

const IMG_RECEPTEN = require('../../assets/landing-recepten.jpeg');
const IMG_HAPJESHELD = require('../../assets/landing-hapjesheld.png');

/* ----------------------------------------
   AnimatedTile — spring scale effect bij press
---------------------------------------- */
interface AnimatedTileProps {
  image: ImageSourcePropType;
  overlayColor: string;
  title: string;
  description: string;
  badge?: string;
  onPress: () => void;
}

function AnimatedTile({
  image,
  overlayColor,
  title,
  description,
  badge,
  onPress,
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
      <Animated.View style={[styles.tile, { transform: [{ scale }] }]}>
        <ImageBackground
          source={image}
          style={styles.tileBg}
          imageStyle={styles.tileImage}
          resizeMode="cover"
        >
          <View style={[styles.overlay, { backgroundColor: overlayColor }]} />
          <View style={styles.tileContent}>
            <Text style={styles.tileTitle}>{title}</Text>
            <Text style={styles.tileDescription}>{description}</Text>
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
          description="Ontdek recepten, plan je week en maak je boodschappenlijst"
          onPress={() => navigation.navigate('Main')}
        />

        <AnimatedTile
          image={IMG_HAPJESHELD}
          overlayColor="rgba(130, 190, 147, 0.80)"
          title="HapjesHeld 2.0"
          description="Stel je vragen over kindervoeding aan onze AI-assistent"
          badge="NIEUW"
          onPress={() => navigation.navigate('HapjesHeld')}
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
    minHeight: 200,
    justifyContent: 'flex-end',
  },
  tileImage: {
    borderRadius: radius.lg,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  tileContent: {
    padding: spacing.xl,
  },
  tileTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.white,
    marginBottom: spacing.xs,
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  tileDescription: {
    fontSize: 15,
    color: colors.white,
    lineHeight: 22,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
