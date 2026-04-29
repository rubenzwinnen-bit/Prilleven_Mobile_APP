/**
 * HAPJESHELD IMAGE HELPER
 *
 * Kies een foto (gallery of camera), comprimeer onder de 3 MB limiet
 * die de Vercel API hanteert, en converteer naar base64.
 *
 * De backend (api/chat.mjs) accepteert JPG, PNG, WebP, GIF — maar we
 * re-encoden alles naar JPG omdat dat het kleinste resultaat geeft en
 * wordt ondersteund door Claude Vision.
 */

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB (API limit)
export const DAILY_IMAGE_LIMIT = 50;

export interface PickedImage {
  /** Base64 payload zonder `data:image/...;base64,` prefix. */
  base64: string;
  /** Lokale URI voor preview in de app. */
  uri: string;
  /** MIME-type — altijd 'image/jpeg' omdat we naar JPG re-encoden. */
  mime: 'image/jpeg';
  /** Bytes (raw, niet base64). */
  bytes: number;
}

/* ----------------------------------------
   Compressie
   Probeer de foto onder de 3 MB limiet te krijgen door quality te verlagen.
   Begin bij 0.85 en stap naar beneden in rondes van 0.15.
---------------------------------------- */
async function compressToFit(uri: string): Promise<PickedImage> {
  const maxWidth = 1600; // ruim voldoende voor vision modellen

  let quality = 0.85;
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }],
      {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );
    if (!result.base64) throw new Error('Kon foto niet converteren.');

    const bytes = Math.floor((result.base64.length * 3) / 4);
    if (bytes <= MAX_IMAGE_BYTES) {
      return {
        base64: result.base64,
        uri: result.uri,
        mime: 'image/jpeg',
        bytes,
      };
    }
    quality -= 0.15;
    if (quality < 0.3) quality = 0.3;
  }
  throw new Error(
    'Foto blijft te groot na compressie. Kies een kleinere foto.'
  );
}

/* ----------------------------------------
   Kies foto uit gallery
---------------------------------------- */
export async function pickImageFromGallery(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Geen toegang tot fotogalerij. Geef permissie in je instellingen.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1, // we doen compressie zelf
  });

  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return compressToFit(result.assets[0].uri);
}

/* ----------------------------------------
   Maak foto met camera
---------------------------------------- */
export async function pickImageFromCamera(): Promise<PickedImage | null> {
  if (Platform.OS === 'web') {
    throw new Error('Camera niet beschikbaar in browser. Gebruik de galerij.');
  }
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    throw new Error('Geen toegang tot camera. Geef permissie in je instellingen.');
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: false,
    quality: 1,
  });

  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return compressToFit(result.assets[0].uri);
}
