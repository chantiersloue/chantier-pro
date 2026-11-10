# Essai S1 — Faisabilité du carnet de chantier (premiers résultats, 29/10/2026)

> Mesures faites sur les vrais PDF produits par les skills (rangés dans `_prive/`, jamais publiés).
> Rendu des pages dans le navigateur, découpe en tuiles de 512 px.
> **Les images de lisibilité sont dans `_prive/s1/`** : elles montrent un vrai plan et restent donc privées.

## 1. Formats réels

| Document (type) | Pages | Formats | Poids du PDF |
|---|---|---|---|
| Plans de gaines techniques | 2 | A3 (297 × 420 mm) | ≈ 1 Mo |
| Plans de repérage des portes | 3 | **1400 × 841 mm** (plus grand qu'un A0) | ≈ 17 Mo |
| Plans de réservations men int | 6 | A4, A3, 1400 × 841 mm | ≈ 17 Mo |
| Proposition de signalétique | 10 | Lettre US, 1400 × 841 mm | ≈ 17 Mo |
| PPSPS | 17 | A4 | ≈ 0,6 Mo |

## 2. Poids des pages-images (tuiles JPEG qualité 0,7)

| Document | 100 dpi | 150 dpi | 200 dpi | Plus grosse page à 200 dpi |
|---|---|---|---|---|
| Gaines techniques (A3) | 0,3 Mo | 0,5 Mo | 0,8 Mo | 0,6 Mo |
| Repérage des portes (3 grands plans) | 5,9 Mo | 11,1 Mo | 16,6 Mo | 7,4 Mo (11 024 × 6 622 px, 286 tuiles) |
| Réservations men int | 6,3 Mo | 11,8 Mo | 17,6 Mo | 7,4 Mo |
| Signalétique | 6,4 Mo | 11,9 Mo | 17,8 Mo | 7,5 Mo |
| PPSPS (A4) | 1,9 Mo | 3,5 Mo | 5,0 Mo | 0,45 Mo |

**Format d'image** (même zone de plan, 2 048 × 2 048 px à 200 dpi) :

| Format | Poids |
|---|---|
| JPEG 0,7 | 293 Ko |
| JPEG 0,55 | 243 Ko |
| **WebP 0,7** | **187 Ko (−36 %)** |
| WebP 0,55 | 168 Ko |
| PNG | 864 Ko |

WebP est lu par tous les téléphones récents : iPhone depuis iOS 14, et Android.

## 3. Lisibilité, à la largeur d'un téléphone, 1 pixel du plan = 1 point de l'écran

| Résolution | Ce qu'on lit |
|---|---|
| 100 dpi | numéros de pièces et grosses cotes : oui ; petites cotes : à la limite ; petites annotations : non |
| 150 dpi | cotes : oui ; petites annotations (≈ 1,5 mm) : à la limite |
| **200 dpi** | cotes et repères : **oui, nets** ; très petites annotations (≈ 1 mm) : lisibles en zoomant encore |

## 4. Conclusions provisoires

1. **Résolution retenue : 200 dpi pour les plans**, avec une pyramide de 3 ou 4 niveaux. 150 dpi suffit pour les documents texte (PPSPS).
2. **Format : WebP qualité 0,7.** Une grande page pèse alors **≈ 4,7 Mo en tuiles** (≈ 6 Mo avec la pyramide).
3. **Sur le téléphone, on ne télécharge jamais une page entière pour la regarder** :
   - l'aperçu de la page (≈ 200 à 300 Ko) s'affiche d'abord ;
   - ensuite, seules les tuiles de la zone regardée sont chargées : environ **20 Ko par tuile**, soit **≈ 100 Ko par écran zoomé**, ce qui passe en 3G ;
   - le téléchargement complet « hors réseau » d'un grand plan (≈ 15 à 20 Mo) est réservé au Wi-Fi.
4. **Stockage** : sans PDF dans Drive, les images d'un document pèsent ≈ 1 fois le poids du PDF. L'estimation du plan (≈ 40 à 80 Mo d'images par chantier) se confirme.
5. **Reste à vérifier**, plus tard :
   - où tournent les skills et s'ils peuvent écrire dans `G:\Mon Drive` (question posée à Franck) ;
   - la tenue d'Apps Script (paquets de tuiles, 5 téléphones en même temps), une fois le serveur TEST déployé.
