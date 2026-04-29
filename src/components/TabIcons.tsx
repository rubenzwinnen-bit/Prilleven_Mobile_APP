/**
 * TAB ICONS
 *
 * Custom gebreide-wol iconen voor de bottom tab bar.
 * SVG inhoud is identiek aan /fotos/groen-*.svg (volledige versie met
 * knit-patroon, schaduw en fuzz-textuur).
 */

import React from 'react';
import { SvgXml } from 'react-native-svg';

const TAB_ICON_SIZE = 56;

const recipesXml = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
<defs>
<pattern id="knit" x="0" y="0" width="14" height="16" patternUnits="userSpaceOnUse">
<path d="M0 0 L7 8 L14 0" fill="none" stroke="#8fbc94" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M-7 8 L0 16 L7 8" fill="none" stroke="#8fbc94" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M7 8 L14 16 L21 8" fill="none" stroke="#8fbc94" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M0 1 L7 9" stroke="#b5d8be" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.7"/>
<path d="M14 1 L7 9" stroke="#b5d8be" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.7"/>
<path d="M0 17 L-7 9" stroke="#b5d8be" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.7"/>
<path d="M14 17 L7 9" stroke="#b5d8be" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.7"/>
<path d="M14 17 L21 9" stroke="#b5d8be" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.7"/>
</pattern>
<pattern id="knitCream" x="0" y="0" width="14" height="16" patternUnits="userSpaceOnUse">
<path d="M0 0 L7 8 L14 0" fill="none" stroke="#e8d8b8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M-7 8 L0 16 L7 8" fill="none" stroke="#e8d8b8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M7 8 L14 16 L21 8" fill="none" stroke="#e8d8b8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M0 1 L7 9" stroke="#fff5e0" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.8"/>
<path d="M14 1 L7 9" stroke="#fff5e0" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.8"/>
<path d="M0 17 L-7 9" stroke="#fff5e0" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.8"/>
<path d="M14 17 L7 9" stroke="#fff5e0" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.8"/>
<path d="M14 17 L21 9" stroke="#fff5e0" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.8"/>
</pattern>
<radialGradient id="shadow" cx="0.5" cy="0.5" r="0.5">
<stop offset="0" stop-color="#000" stop-opacity="0.18"/>
<stop offset="1" stop-color="#000" stop-opacity="0"/>
</radialGradient>
<filter id="fuzz" x="-10%" y="-10%" width="120%" height="120%">
<feTurbulence type="fractalNoise" baseFrequency="3" numOctaves="2" seed="7"/>
<feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0 0.25 0"/>
<feComposite in2="SourceGraphic" operator="in"/>
</filter>
</defs>
<g transform="translate(200 200)">
<ellipse cx="0" cy="115" rx="90" ry="12" fill="url(#shadow)"/>
<g transform="translate(-35 0)">
<g>
<rect x="-22" y="-100" width="6" height="35" rx="3" fill="#7ab088"/>
<rect x="-12" y="-100" width="6" height="35" rx="3" fill="#7ab088"/>
<rect x="-2" y="-100" width="6" height="35" rx="3" fill="#7ab088"/>
<rect x="8" y="-100" width="6" height="35" rx="3" fill="#7ab088"/>
<line x1="-19" y1="-95" x2="-19" y2="-70" stroke="#b5d8be" stroke-width="1" stroke-linecap="round"/>
<line x1="-9" y1="-95" x2="-9" y2="-70" stroke="#b5d8be" stroke-width="1" stroke-linecap="round"/>
<line x1="1" y1="-95" x2="1" y2="-70" stroke="#b5d8be" stroke-width="1" stroke-linecap="round"/>
<line x1="11" y1="-95" x2="11" y2="-70" stroke="#b5d8be" stroke-width="1" stroke-linecap="round"/>
</g>
<path d="M-25-70 L17-70 Q22-70 22-65 L20-50 Q19-45 14-45 L-20-45 Q-25-45-25-50 L-27-65 Q-27-70-25-70 Z" fill="#7ab088"/>
<path d="M-25-70 L17-70 Q22-70 22-65 L20-50 Q19-45 14-45 L-20-45 Q-25-45-25-50 L-27-65 Q-27-70-25-70 Z" fill="url(#knit)"/>
<rect x="-12" y="-50" width="22" height="145" rx="11" fill="#7ab088"/>
<rect x="-12" y="-50" width="22" height="145" rx="11" fill="url(#knit)"/>
<path d="M-25-70 L17-70 Q22-70 22-65 L20-50 Q19-45 14-45 L-20-45 Q-25-45-25-50 L-27-65 Q-27-70-25-70 Z" fill="none" stroke="#3a5a48" stroke-width="1.2" opacity="0.5"/>
<rect x="-12" y="-50" width="22" height="145" rx="11" fill="none" stroke="#3a5a48" stroke-width="1.2" opacity="0.5"/>
<rect x="-12" y="60" width="22" height="14" fill="#d4b896"/>
<rect x="-12" y="60" width="22" height="14" fill="url(#knitCream)"/>
<rect x="-12" y="60" width="22" height="14" fill="none" stroke="#3a5a48" stroke-width="1" opacity="0.4"/>
<g opacity="0.4">
<rect x="-30" y="-100" width="60" height="200" fill="#fff" filter="url(#fuzz)"/>
</g>
</g>
<g transform="translate(35 0)">
<path d="M-13-100 L13-100 Q16-100 16-97 L14-50 L-14-50 L-16-97 Q-16-100-13-100 Z" fill="#7ab088"/>
<path d="M-13-100 L13-100 Q16-100 16-97 L14-50 L-14-50 L-16-97 Q-16-100-13-100 Z" fill="url(#knit)"/>
<path d="M-13-100 L13-100 Q16-100 16-97 L14-50 L-14-50 L-16-97 Q-16-100-13-100 Z" fill="none" stroke="#3a5a48" stroke-width="1.2" opacity="0.5"/>
<path d="M-14-95 L-13-55" stroke="#b5d8be" stroke-width="1.2" fill="none" stroke-linecap="round" opacity="0.7"/>
<rect x="-12" y="-50" width="24" height="145" rx="11" fill="#7ab088"/>
<rect x="-12" y="-50" width="24" height="145" rx="11" fill="url(#knit)"/>
<rect x="-12" y="-50" width="24" height="145" rx="11" fill="none" stroke="#3a5a48" stroke-width="1.2" opacity="0.5"/>
<rect x="-12" y="60" width="24" height="14" fill="#d4b896"/>
<rect x="-12" y="60" width="24" height="14" fill="url(#knitCream)"/>
<rect x="-12" y="60" width="24" height="14" fill="none" stroke="#3a5a48" stroke-width="1" opacity="0.4"/>
<g opacity="0.4">
<rect x="-20" y="-100" width="40" height="200" fill="#fff" filter="url(#fuzz)"/>
</g>
</g>
</g>
</svg>`;

const scheduleXml = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
<defs>
<pattern id="knit" x="0" y="0" width="14" height="16" patternUnits="userSpaceOnUse">
<path d="M0 0 L7 8 L14 0" fill="none" stroke="#8fbc94" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M-7 8 L0 16 L7 8" fill="none" stroke="#8fbc94" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M7 8 L14 16 L21 8" fill="none" stroke="#8fbc94" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M0 1 L7 9" stroke="#b5d8be" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.7"/>
<path d="M14 1 L7 9" stroke="#b5d8be" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.7"/>
<path d="M0 17 L-7 9" stroke="#b5d8be" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.7"/>
<path d="M14 17 L7 9" stroke="#b5d8be" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.7"/>
<path d="M14 17 L21 9" stroke="#b5d8be" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.7"/>
</pattern>
<pattern id="knitCream" x="0" y="0" width="14" height="16" patternUnits="userSpaceOnUse">
<path d="M0 0 L7 8 L14 0" fill="none" stroke="#e8d8b8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M-7 8 L0 16 L7 8" fill="none" stroke="#e8d8b8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M7 8 L14 16 L21 8" fill="none" stroke="#e8d8b8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M0 1 L7 9" stroke="#fff5e0" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.8"/>
<path d="M14 1 L7 9" stroke="#fff5e0" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.8"/>
<path d="M0 17 L-7 9" stroke="#fff5e0" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.8"/>
<path d="M14 17 L7 9" stroke="#fff5e0" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.8"/>
<path d="M14 17 L21 9" stroke="#fff5e0" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.8"/>
</pattern>
<path id="calShape" d="M-90-70 L90-70 Q100-70 100-60 L100 70 Q100 80 90 80 L-90 80 Q-100 80-100 70 L-100-60 Q-100-70-90-70 Z"/>
<clipPath id="calClip"><use href="#calShape"/></clipPath>
<radialGradient id="shadow" cx="0.5" cy="0.5" r="0.5">
<stop offset="0" stop-color="#000" stop-opacity="0.18"/>
<stop offset="1" stop-color="#000" stop-opacity="0"/>
</radialGradient>
<filter id="fuzz" x="-10%" y="-10%" width="120%" height="120%">
<feTurbulence type="fractalNoise" baseFrequency="3" numOctaves="2" seed="7"/>
<feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0 0.25 0"/>
<feComposite in2="SourceGraphic" operator="in"/>
</filter>
</defs>
<g transform="translate(200 200)">
<ellipse cx="0" cy="95" rx="110" ry="12" fill="url(#shadow)"/>
<use href="#calShape" fill="#7ab088"/>
<use href="#calShape" fill="url(#knit)"/>
<g clip-path="url(#calClip)">
<rect x="-100" y="-70" width="200" height="32" fill="#5a8a68"/>
<g stroke="#8fbc94" stroke-width="3" stroke-linecap="round" fill="none">
<line x1="-90" y1="-68" x2="-90" y2="-38"/>
<line x1="-78" y1="-68" x2="-78" y2="-38"/>
<line x1="-66" y1="-68" x2="-66" y2="-38"/>
<line x1="-54" y1="-68" x2="-54" y2="-38"/>
<line x1="-42" y1="-68" x2="-42" y2="-38"/>
<line x1="-30" y1="-68" x2="-30" y2="-38"/>
<line x1="-18" y1="-68" x2="-18" y2="-38"/>
<line x1="-6" y1="-68" x2="-6" y2="-38"/>
<line x1="6" y1="-68" x2="6" y2="-38"/>
<line x1="18" y1="-68" x2="18" y2="-38"/>
<line x1="30" y1="-68" x2="30" y2="-38"/>
<line x1="42" y1="-68" x2="42" y2="-38"/>
<line x1="54" y1="-68" x2="54" y2="-38"/>
<line x1="66" y1="-68" x2="66" y2="-38"/>
<line x1="78" y1="-68" x2="78" y2="-38"/>
<line x1="90" y1="-68" x2="90" y2="-38"/>
</g>
</g>
<g>
<rect x="-50" y="-90" width="10" height="35" rx="5" fill="#d4b896"/>
<rect x="-50" y="-90" width="10" height="35" rx="5" fill="none" stroke="#8a7050" stroke-width="1.5"/>
<rect x="40" y="-90" width="10" height="35" rx="5" fill="#d4b896"/>
<rect x="40" y="-90" width="10" height="35" rx="5" fill="none" stroke="#8a7050" stroke-width="1.5"/>
</g>
<g clip-path="url(#calClip)">
<line x1="-100" y1="0" x2="100" y2="0" stroke="#3a5a48" stroke-width="1.5" opacity="0.4"/>
<g stroke="#3a5a48" stroke-width="1.5" opacity="0.4">
<line x1="-71" y1="-30" x2="-71" y2="70"/>
<line x1="-43" y1="-30" x2="-43" y2="70"/>
<line x1="-14" y1="-30" x2="-14" y2="70"/>
<line x1="14" y1="-30" x2="14" y2="70"/>
<line x1="43" y1="-30" x2="43" y2="70"/>
<line x1="71" y1="-30" x2="71" y2="70"/>
</g>
<g fill="#d4b896">
<rect x="-92" y="-22" width="14" height="14" rx="2"/>
<rect x="-64" y="-22" width="14" height="14" rx="2"/>
<rect x="-35" y="-22" width="14" height="14" rx="2"/>
<rect x="-7" y="-22" width="14" height="14" rx="2"/>
<rect x="22" y="-22" width="14" height="14" rx="2"/>
<rect x="50" y="-22" width="14" height="14" rx="2"/>
<rect x="78" y="-22" width="14" height="14" rx="2"/>
</g>
<g>
<rect x="-92" y="-22" width="14" height="14" rx="2" fill="url(#knitCream)"/>
<rect x="-64" y="-22" width="14" height="14" rx="2" fill="url(#knitCream)"/>
<rect x="-35" y="-22" width="14" height="14" rx="2" fill="url(#knitCream)"/>
<rect x="-7" y="-22" width="14" height="14" rx="2" fill="url(#knitCream)"/>
<rect x="22" y="-22" width="14" height="14" rx="2" fill="url(#knitCream)"/>
<rect x="50" y="-22" width="14" height="14" rx="2" fill="url(#knitCream)"/>
<rect x="78" y="-22" width="14" height="14" rx="2" fill="url(#knitCream)"/>
</g>
<g fill="#d4b896">
<rect x="-92" y="20" width="42" height="8" rx="3"/>
<rect x="-30" y="38" width="56" height="8" rx="3"/>
<rect x="36" y="56" width="42" height="8" rx="3"/>
</g>
<g>
<rect x="-92" y="20" width="42" height="8" rx="3" fill="url(#knitCream)"/>
<rect x="-30" y="38" width="56" height="8" rx="3" fill="url(#knitCream)"/>
<rect x="36" y="56" width="42" height="8" rx="3" fill="url(#knitCream)"/>
</g>
</g>
<g clip-path="url(#calClip)">
<rect x="-100" y="-90" width="200" height="180" fill="#fff" filter="url(#fuzz)" opacity="0.4"/>
</g>
<use href="#calShape" fill="none" stroke="#3a5a48" stroke-width="1.5" opacity="0.5"/>
</g>
</svg>`;

const favoritesXml = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
<defs>
<pattern id="knit" x="0" y="0" width="14" height="16" patternUnits="userSpaceOnUse">
<path d="M0 0 L7 8 L14 0" fill="none" stroke="#8fbc94" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M-7 8 L0 16 L7 8" fill="none" stroke="#8fbc94" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M7 8 L14 16 L21 8" fill="none" stroke="#8fbc94" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M0 1 L7 9" stroke="#b5d8be" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.7"/>
<path d="M14 1 L7 9" stroke="#b5d8be" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.7"/>
<path d="M0 17 L-7 9" stroke="#b5d8be" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.7"/>
<path d="M14 17 L7 9" stroke="#b5d8be" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.7"/>
<path d="M14 17 L21 9" stroke="#b5d8be" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.7"/>
</pattern>
<path id="heartShape" d="M0-55 C-25-80-75-75-75-20 C-75 20-30 55 0 95 C30 55 75 20 75-20 C75-75 25-80 0-55 Z"/>
<clipPath id="heartClip"><use href="#heartShape"/></clipPath>
<radialGradient id="shadow" cx="0.5" cy="0.5" r="0.5">
<stop offset="0" stop-color="#000" stop-opacity="0.18"/>
<stop offset="1" stop-color="#000" stop-opacity="0"/>
</radialGradient>
<filter id="fuzz" x="-10%" y="-10%" width="120%" height="120%">
<feTurbulence type="fractalNoise" baseFrequency="3" numOctaves="2" seed="7"/>
<feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0 0.25 0"/>
<feComposite in2="SourceGraphic" operator="in"/>
</filter>
</defs>
<g transform="translate(200 195)">
<ellipse cx="0" cy="105" rx="80" ry="14" fill="url(#shadow)"/>
<use href="#heartShape" fill="#7ab088"/>
<use href="#heartShape" fill="url(#knit)"/>
<g clip-path="url(#heartClip)">
<ellipse cx="-25" cy="-30" rx="25" ry="18" fill="#fff" opacity="0.08"/>
<ellipse cx="0" cy="80" rx="60" ry="12" fill="#000" opacity="0.12"/>
<rect x="-100" y="-100" width="200" height="200" fill="#fff" filter="url(#fuzz)" opacity="0.4"/>
</g>
<use href="#heartShape" fill="none" stroke="#3a5a48" stroke-width="1.5" opacity="0.5"/>
</g>
</svg>`;

const shoppingXml = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
<defs>
<pattern id="knit" x="0" y="0" width="14" height="16" patternUnits="userSpaceOnUse">
<path d="M0 0 L7 8 L14 0" fill="none" stroke="#8fbc94" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M-7 8 L0 16 L7 8" fill="none" stroke="#8fbc94" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M7 8 L14 16 L21 8" fill="none" stroke="#8fbc94" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M0 1 L7 9" stroke="#b5d8be" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.7"/>
<path d="M14 1 L7 9" stroke="#b5d8be" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.7"/>
<path d="M0 17 L-7 9" stroke="#b5d8be" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.7"/>
<path d="M14 17 L7 9" stroke="#b5d8be" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.7"/>
<path d="M14 17 L21 9" stroke="#b5d8be" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.7"/>
</pattern>
<pattern id="knitCream" x="0" y="0" width="14" height="16" patternUnits="userSpaceOnUse">
<path d="M0 0 L7 8 L14 0" fill="none" stroke="#e8d8b8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M-7 8 L0 16 L7 8" fill="none" stroke="#e8d8b8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M7 8 L14 16 L21 8" fill="none" stroke="#e8d8b8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M0 1 L7 9" stroke="#fff5e0" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.8"/>
<path d="M14 1 L7 9" stroke="#fff5e0" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.8"/>
<path d="M0 17 L-7 9" stroke="#fff5e0" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.8"/>
<path d="M14 17 L7 9" stroke="#fff5e0" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.8"/>
<path d="M14 17 L21 9" stroke="#fff5e0" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.8"/>
</pattern>
<path id="basket" d="M-100-65 L100-65 L75 110 Q75 120 65 120 L-65 120 Q-75 120-75 110 Z"/>
<clipPath id="basketClip"><use href="#basket"/></clipPath>
<radialGradient id="shadow" cx="0.5" cy="0.5" r="0.5">
<stop offset="0" stop-color="#000" stop-opacity="0.18"/>
<stop offset="1" stop-color="#000" stop-opacity="0"/>
</radialGradient>
<filter id="fuzz" x="-10%" y="-10%" width="120%" height="120%">
<feTurbulence type="fractalNoise" baseFrequency="3" numOctaves="2" seed="5"/>
<feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0 0.25 0"/>
<feComposite in2="SourceGraphic" operator="in"/>
</filter>
</defs>
<g transform="translate(200 200)">
<ellipse cx="0" cy="135" rx="115" ry="14" fill="url(#shadow)"/>
<g>
<use href="#basket" fill="#7ab088"/>
<use href="#basket" fill="url(#knit)"/>
<g clip-path="url(#basketClip)">
<rect x="-100" y="-5" width="200" height="20" fill="#d4b896"/>
<rect x="-100" y="-5" width="200" height="20" fill="url(#knitCream)"/>
<rect x="-100" y="55" width="200" height="20" fill="#d4b896"/>
<rect x="-100" y="55" width="200" height="20" fill="url(#knitCream)"/>
</g>
<g clip-path="url(#basketClip)">
<rect x="-100" y="-65" width="200" height="22" fill="#5a8a68"/>
<g stroke="#8fbc94" stroke-width="2.5" stroke-linecap="round" fill="none">
<line x1="-92" y1="-63" x2="-92" y2="-43"/>
<line x1="-82" y1="-63" x2="-82" y2="-43"/>
<line x1="-72" y1="-63" x2="-72" y2="-43"/>
<line x1="-62" y1="-63" x2="-62" y2="-43"/>
<line x1="-52" y1="-63" x2="-52" y2="-43"/>
<line x1="-42" y1="-63" x2="-42" y2="-43"/>
<line x1="-32" y1="-63" x2="-32" y2="-43"/>
<line x1="-22" y1="-63" x2="-22" y2="-43"/>
<line x1="-12" y1="-63" x2="-12" y2="-43"/>
<line x1="-2" y1="-63" x2="-2" y2="-43"/>
<line x1="8" y1="-63" x2="8" y2="-43"/>
<line x1="18" y1="-63" x2="18" y2="-43"/>
<line x1="28" y1="-63" x2="28" y2="-43"/>
<line x1="38" y1="-63" x2="38" y2="-43"/>
<line x1="48" y1="-63" x2="48" y2="-43"/>
<line x1="58" y1="-63" x2="58" y2="-43"/>
<line x1="68" y1="-63" x2="68" y2="-43"/>
<line x1="78" y1="-63" x2="78" y2="-43"/>
<line x1="88" y1="-63" x2="88" y2="-43"/>
</g>
</g>
<g clip-path="url(#basketClip)">
<g transform="translate(0 38)">
<path d="M0-15 C-7-22-21-21-21-5 C-21 6-8 16 0 27 C8 16 21 6 21-5 C21-21 7-22 0-15 Z" fill="#d4b896"/>
<path d="M0-15 C-7-22-21-21-21-5 C-21 6-8 16 0 27 C8 16 21 6 21-5 C21-21 7-22 0-15 Z" fill="url(#knitCream)"/>
</g>
</g>
<g clip-path="url(#basketClip)">
<rect x="-100" y="100" width="200" height="22" fill="#000" opacity="0.1"/>
<ellipse cx="-50" cy="-30" rx="40" ry="25" fill="#fff" opacity="0.06"/>
</g>
<g clip-path="url(#basketClip)" opacity="0.4">
<rect x="-100" y="-65" width="200" height="190" fill="#fff" filter="url(#fuzz)"/>
</g>
<use href="#basket" fill="none" stroke="#3a5a48" stroke-width="1.5" opacity="0.5"/>
</g>
<g>
<path d="M-60-60 C-65-115-25-140-20-65" fill="none" stroke="#7ab088" stroke-width="15" stroke-linecap="round"/>
<g stroke="#b5d8be" stroke-width="1.2" fill="none" stroke-linecap="round">
<path d="M-65-70 l3 3 l3-3"/>
<path d="M-65-85 l3 3 l3-3"/>
<path d="M-62-100 l3 3 l3-3"/>
<path d="M-55-115 l3 3 l3-3"/>
<path d="M-42-125 l3 3 l3-3"/>
<path d="M-28-122 l3 3 l3-3"/>
<path d="M-22-108 l3 3 l3-3"/>
<path d="M-20-92 l3 3 l3-3"/>
<path d="M-19-77 l3 3 l3-3"/>
</g>
</g>
<g>
<path d="M60-60 C65-115 25-140 20-65" fill="none" stroke="#7ab088" stroke-width="15" stroke-linecap="round"/>
<g stroke="#b5d8be" stroke-width="1.2" fill="none" stroke-linecap="round">
<path d="M59-70 l3 3 l3-3"/>
<path d="M59-85 l3 3 l3-3"/>
<path d="M56-100 l3 3 l3-3"/>
<path d="M49-115 l3 3 l3-3"/>
<path d="M36-125 l3 3 l3-3"/>
<path d="M22-122 l3 3 l3-3"/>
<path d="M16-108 l3 3 l3-3"/>
<path d="M14-92 l3 3 l3-3"/>
<path d="M13-77 l3 3 l3-3"/>
</g>
</g>
</g>
</svg>`;

type Props = { focused?: boolean };

function makeIcon(xml: string) {
  return ({ focused }: Props) => (
    <SvgXml
      xml={xml}
      width={TAB_ICON_SIZE}
      height={TAB_ICON_SIZE}
      opacity={focused ? 1 : 0.55}
      style={{ transform: [{ translateY: 6 }] }}
    />
  );
}

export const RecipesIcon = makeIcon(recipesXml);
export const ScheduleIcon = makeIcon(scheduleXml);
export const FavoritesIcon = makeIcon(favoritesXml);
export const ShoppingIcon = makeIcon(shoppingXml);
