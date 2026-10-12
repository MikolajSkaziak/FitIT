import type { LegalDoc } from './types';

/**
 * English translation of docs/prawne/polityka-prywatnosci.md (a Polish DRAFT, version of October 9, 2026).
 * Not reviewed by a lawyer. Keep section order, numbering and placeholders in step with the source.
 * The "note for the owner" blocks of the source are working notes and are deliberately not published here.
 */
export const privacy: LegalDoc = {
  metaTitle: 'Privacy Policy — fitit.',
  metaDescription:
    'The privacy policy of the fitit. app (draft): what data we collect, why, on what legal basis, for how long, who receives it and what rights you have.',
  title: 'Privacy Policy',
  draft: 'Draft — not yet in force',
  version: 'Draft of October 9, 2026',
  lastUpdated: 'October 9, 2026',
  effective: '[TO BE COMPLETED: effective date]',
  intro: [
    {
      type: 'p',
      text: 'fitit. is in the testing phase (beta). It is free and has no purchases. This policy describes what data we collect, why, who we pass it to and what rights you have. We wrote it so that you can read it without any legal knowledge.',
    },
  ],
  sections: [
    {
      n: 1,
      title: 'The most important points in brief',
      blocks: [
        {
          type: 'ul',
          items: [
            'An account can be created by a person who is at least 16 years old.',
            'By creating an account, you agree to your photos being processed by external AI services (describing clothes, putting outfits together, the image on the figure). This is stated in the app right below the “Create account” button. You can withdraw your consent at any time in your profile.',
            'The app does not accept photos of other people. The image on the figure is drawn on a ready-made, generated figure that you choose when you create your account.',
            'You can voluntarily do a color analysis from a photo of your face (a selfie). The photo is sent to the AI provider only for this analysis and deleted right after it. Only the result stays: your color type and palette. Instead, you can answer three questions, without a photo.',
            'We round the location from your phone to 0.1 degree (about 11 kilometers) and use it only to check the weather. We do not keep a history of places.',
            'We store your password only as a hash from which it cannot be read.',
            'You can delete your account in the app. Together with it, we delete your data and files.',
            'We do not show ads and we do not sell data.',
          ],
        },
      ],
    },
    {
      n: 2,
      title: 'Who is the controller of your data',
      blocks: [
        { type: 'p', text: 'The controller is a natural person:' },
        {
          type: 'kv',
          rows: [
            ['Full name', '[TO BE COMPLETED: controller’s full name]'],
            ['Mailing address', '[TO BE COMPLETED: controller’s address]'],
            ['E-mail for privacy matters', '[TO BE COMPLETED: contact e-mail address]'],
          ],
        },
        {
          type: 'p',
          text: 'In the rest of this policy, we refer to the controller as “we”. We have not appointed a data protection officer because we are not required to. You can raise privacy matters at the e-mail address above.',
        },
      ],
    },
    {
      n: 3,
      title: 'What data, what for, on what legal basis and for how long',
      blocks: [
        {
          type: 'p',
          text: 'GDPR means Regulation (EU) 2016/679. The legal bases are: Article 6(1)(a) (your consent), (b) (performance of a contract, that is, making the app available to you under the terms of use) and (f) (our legitimate interest).',
        },
        {
          type: 'entries',
          head: ['Data', 'Purpose', 'Legal basis', 'How long'],
          rows: [
            [
              'E-mail address and password (the password as a hash)',
              'Creating the account, logging in, contact about the account',
              'Contract (b)',
              'Until the account is deleted',
            ],
            ['First name', 'Addressing you in the app', 'Contract (b)', 'Until the account is deleted'],
            [
              'Date of birth',
              'Confirming that you are at least 16 years old',
              'Legitimate interest (f): we admit only people of the right age to the service, see also Article 8 GDPR',
              'Until the account is deleted',
            ],
            [
              'Gender (four values to choose from: woman, man, non-binary person, prefer not to say)',
              'Showing the body types that fit the selected gender (non-binary people and those who prefer not to say see all of them)',
              'Contract (b)',
              'Until the account is deleted or changed in the profile',
            ],
            [
              'Chosen figure, preferred styles, thermal preference (“I usually feel cold”, “normal”, “I usually feel warm”)',
              'Tailoring suggestions and the image on the figure to you. The figure is used only for the image on the figure',
              'Contract (b)',
              'Until the account is deleted or changed in the profile',
            ],
            [
              'Color analysis result (voluntary): color type (one of twelve), “wear more often” and “be more careful with” color palettes, and the date of the analysis. We do not store the photo of your face or your answers to the questions',
              'Showing the palette in the profile, favoring your colors when putting outfits together',
              'Your consent (a), see section 4',
              'Until the result is deleted in the profile or the account is deleted',
            ],
            [
              'Temporarily: the photo of your face (selfie) sent for color analysis',
              'Carrying out the color analysis',
              'Your consent (a)',
              'We delete it from storage in the same request in which we receive the analysis result, also when the analysis fails. A cleanup job deletes any leftovers after one hour at the latest',
            ],
            [
              'Progress of the short guide after you create your account (a marker of which step you have not finished and whether the guide is complete)',
              'Resuming the guide after you close the app and not showing it a second time',
              'Contract (b)',
              'Until the account is deleted',
            ],
            [
              'Seasons (spring, summer, autumn, winter) assigned to a garment',
              'Organizing the wardrobe and filtering. Seasons do not affect how outfits are put together',
              'Contract (b)',
              'Until the garment or the account is deleted',
            ],
            [
              'Weather place: how it was determined (phone location or a typed-in city), the name of the place, coordinates rounded to 0.1 degree',
              'Checking the weather, working out what “today” is for you (for the weather and the daily limits)',
              'Contract (b)',
              'Until the account is deleted or the place is changed in the profile. We do not keep a history of places',
            ],
            [
              'Photos of clothes (the photo sent from your phone and the cutout without a background)',
              'Showing the wardrobe, describing clothes',
              'Storing and showing: contract (b). Sending to external AI services: your consent (a)',
              'Until the garment or the account is deleted',
            ],
            [
              'Description of a garment: category, type, name, colors, pattern, material, formality, warmth, rain resistance, styles, a one-sentence description',
              'Searching and filtering the wardrobe, putting outfits together',
              'Contract (b). Passing descriptions to Google (Gemini API): your consent (a)',
              'Until the garment or the account is deleted',
            ],
            [
              'The “in the wash” and “rarely worn” marks, the number and date of the last wear',
              'Skipping clothes that are in the wash, pointing out forgotten clothes, the wardrobe usage indicator',
              'Contract (b)',
              'Until the garment or the account is deleted',
            ],
            [
              'Outfits: composition, occasion, occasion note, the weather at the time of the suggestion, thumbs rating, saving, “I’m wearing this”',
              'Showing suggestions and saved outfits, and learning your preferences',
              'Contract (b). Passing part of this data to Google (Gemini API): your consent (a)',
              'Until the outfit or the account is deleted',
            ],
            [
              'Images on the figure and their status',
              'Showing the visualization',
              'Contract (b)',
              'Until the account is deleted [TO BE COMPLETED: whether a visualization can be deleted separately, depending on the implementation]',
            ],
            [
              'AI consent (a marker with a date). We record it when the account is created and delete it when you withdraw consent in the profile',
              'Documenting that consent was given and checking it before a photo is sent',
              'Legitimate interest (f): the obligation to demonstrate consent (Article 7(1) GDPR)',
              'Until the account is deleted or consent is withdrawn',
            ],
            [
              'Daily usage counters (new clothes, requests for suggestions, visualizations)',
              'Enforcing the daily limits',
              'Legitimate interest (f): protecting the service from abuse and controlling costs',
              'Until the account is deleted',
            ],
            [
              'AI cost log (type of operation, model, cost, time, result)',
              'Controlling costs and errors',
              'Legitimate interest (f)',
              'Entries remain after the account is deleted, but without any link to you. [TO BE COMPLETED: how long we keep log entries]',
            ],
            [
              'Session data: a hash of the refresh token and its expiry date, the number of failed login attempts',
              'Keeping you logged in, protecting the account from password guessing',
              'Contract (b) and legitimate interest (f): security',
              'The refresh token for up to 30 days or until you log out. After 5 failed login attempts, the account is locked for 5 minutes',
            ],
            [
              'Technical connection data and server logs: IP address, time and type of request, error messages',
              'Security, rate limiting, detecting and fixing errors',
              'Legitimate interest (f)',
              '[TO BE COMPLETED: server log retention period]',
            ],
            [
              'Correspondence with us (e-mail, complaints)',
              'Replying to a message, handling a complaint',
              'Legitimate interest (f) or contract (b)',
              '[TO BE COMPLETED: correspondence retention period]',
            ],
          ],
        },
        {
          type: 'p',
          text: 'Providing your e-mail, password, first name, date of birth and gender, and choosing a figure, is needed to create an account. Without them, we cannot create it. Consent to processing by AI services is given by creating the account itself (see section 4); without it, we cannot make the app work, because the core of the app is describing clothes and putting outfits together. Styles, thermal preference, weather place and color analysis are voluntary. Without a weather place, the app cannot check the weather.',
        },
        {
          type: 'p',
          text: 'We do not ask for special categories of data (for example, about health) and we ask you not to enter them in text fields. This applies especially to the occasion note, which is free text.',
        },
      ],
    },
    {
      n: 4,
      title: 'Photos of clothes and AI services',
      blocks: [
        { type: 'h3', text: 'What the app does' },
        {
          type: 'p',
          text: 'When you add a photo of a garment, the app shrinks it on your phone (the longer side to 1280 pixels) and saves it anew. When it is saved anew, location data and camera data disappear from the photo. The photo goes from your phone directly to file storage, not through our server.',
        },
        { type: 'p', text: 'Then, in the background:' },
        {
          type: 'ol',
          items: [
            'An AI service removes the background from the photo of the garment.',
            'An AI model describes the garment: it gives the category, colors, material and similar features. You can correct these descriptions.',
            'When you ask for suggestions, an AI model picks outfits from the descriptions of your clothes, guided by the weather, the occasion and your preferences.',
            'When you ask for an image on the figure, an image model draws the ready-made figure you chose wearing the clothes from the outfit.',
          ],
        },
        {
          type: 'p',
          text: 'Images on the figure are illustrative. In addition, images from Google models contain an invisible SynthID watermark, which indicates that the image was generated by AI.',
        },

        { type: 'h3', text: 'Color analysis from a photo of your face (voluntary)' },
        {
          type: 'p',
          text: 'After you create your account, the app offers a color analysis. You can skip it, do it later in your profile, or choose the variant without a photo: three questions (skin tone, hair color, eye color). If you choose a selfie:',
        },
        {
          type: 'ol',
          items: [
            'The app shrinks the photo on your phone and sends it directly to file storage, to a separate `selfie/` folder in your prefix.',
            'The AI provider sees the photo and determines your color type (one of twelve seasonal types) and palette.',
            'In the same request in which we receive the result, we delete the photo from storage. We do this also when the analysis fails. A cleanup job deletes any leftovers after an hour.',
            'We save only the result (the type and the palette), not the photo.',
          ],
        },
        {
          type: 'p',
          text: 'Right below the selfie button, the app shows a permanently visible notice: “Your photo is sent to our AI service for this analysis and deleted right after. We keep only your palette.” There is no separate checkbox or extra step there. A limited number of analyses can be done per day (3 by default). You can delete the result in your profile at any time.',
        },

        { type: 'h3', text: 'Consent' },
        {
          type: 'p',
          text: 'Creating an account is consent to your photos being processed by external AI services: photos of clothes (removing the background, describing), descriptions of clothes (putting outfits together) and, if you use it, the photo for color analysis. The notice is in the app in one sentence right below the “Create account” button (“By creating an account you agree to our Terms and Privacy Policy”, with links to the terms of use and to this policy). There is no longer a separate consent screen before the first photo. The date of consent is saved in your profile when the account is created, and before every photo is sent to an AI service, the server checks that consent has not been withdrawn.',
        },
        {
          type: 'p',
          text: '**You can withdraw consent at any time in your profile.** Withdrawal does not affect the lawfulness of processing carried out before it. After withdrawal, we stop sending new photos to AI services. Clothes that are waiting to be described stay in your wardrobe, and you can fill in their descriptions by hand.',
        },

        { type: 'h3', text: 'What we do not send' },
        {
          type: 'ul',
          items: [
            'Apart from the optional selfie for color analysis (see above), we do not send photos of people. The app is for photographing clothes, not people. We ask that photos of clothes contain no faces or other people, although we cannot technically rule it out. The describing model rejects photos that show no garment or several garments at once.',
            'Your name, e-mail address, date of birth and coordinates do not reach the models. As a gentle hint, the model that puts outfits together receives the names of the best colors from your palette, if you have one.',
            'No text you have typed goes to the image generator. The occasion note goes only to the model that puts outfits together.',
          ],
        },

        { type: 'h3', text: 'What we set with providers' },
        {
          type: 'p',
          text: 'With fal.ai, we can turn off the storage of the content of requests and results (the `Fal:DisablePayloadStorage` setting). However, the retention rules at each provider depend on that provider’s terms.',
        },
        {
          type: 'p',
          text: 'Retention periods at providers and use of data for model training: Google (Gemini API) retention period: [TO BE COMPLETED: period, after checking the terms of Google (Gemini API)]. fal.ai and Google retention period: [TO BE COMPLETED: period, after checking the terms of fal.ai]. Whether providers use the submitted data to train their models: [TO BE COMPLETED: confirmation based on the providers’ terms].',
        },
      ],
    },
    {
      n: 5,
      title: 'Location and weather',
      blocks: [
        { type: 'p', text: 'Location is optional. You have two options:' },
        {
          type: 'ul',
          items: [
            '**Phone location.** The app asks the system for access to location. We round the coordinates to 0.1 degree (about 11 kilometers) on the phone and once more on the server. That is enough for a forecast and does not let anyone pinpoint your address.',
            '**A typed-in city.** We look the place up through the Open-Meteo service and save its name and the rounded coordinates.',
          ],
        },
        { type: 'p', text: 'You can also skip the place and set it later.' },
        {
          type: 'p',
          text: 'We use the rounded coordinates for two things: checking the weather and working out what day it is for you (the time zone), so that daily limits and suggestions are counted according to your day. We do not track your position over time and we do not keep a history of places. Only one, current weather place is saved.',
        },
        {
          type: 'p',
          text: 'The forecast is fetched by our server, not by your phone. Open-Meteo receives the rounded coordinates (or the typed-in name of the place) without your identifier and sees the IP address of our server, not of your phone.',
        },
      ],
    },
    {
      n: 6,
      title: 'Who we pass data to',
      blocks: [
        {
          type: 'p',
          text: 'We do not sell data and we do not share it for advertising purposes. We use subcontractors who process data on our behalf (the GDPR calls them processors).',
        },
        {
          type: 'entries',
          head: ['Recipient', 'What it receives', 'Purpose'],
          rows: [
            [
              'Cloudflare (R2 service)',
              'All files: photos of clothes, cutouts, images on the figure. The files are in a bucket with EU jurisdiction',
              'Storing files',
            ],
            [
              'Google (Gemini API service)',
              'Cutouts of clothes (describing clothes). Text descriptions of clothes and context: the weather without the name of the place, the occasion, the occasion note, preferred styles, thermal preference, color names from the palette (if you have an analysis), a few recently rated outfits (putting outfits together). Descriptions and names of the clothes in an outfit you are putting together yourself, with the occasion and the weather without the name of the place (outfit hints). The photo of your face, if you do the color analysis from a photo; we delete the photo itself from our storage in the same request, and the questionnaire used instead of a photo does not leave our server',
              'Describing clothes, putting outfits together, outfit hints, color analysis',
            ],
            [
              'fal.ai, and through it the model providers (BiRefNet for background removal; Google’s Nano Banana 2 model for the image on the figure)',
              'Photos of clothes (background removal). Cutouts of clothes, the image of the ready-made figure you chose and a description of the outfit made up of the descriptions of the clothes (image on the figure). We download the finished image into our own storage; the file address at fal.ai does not reach the phone',
              'Removing backgrounds and generating the image on the figure',
            ],
            [
              'Open-Meteo',
              'Rounded coordinates or a typed-in name of a place, without your identifier',
              'Weather forecast and place search',
            ],
            [
              '[TO BE COMPLETED: provider of the server the app runs on]',
              'All data stored in the database and the server logs',
              'Hosting',
            ],
            [
              '[TO BE COMPLETED: e-mail provider, once password reset exists]',
              'The e-mail address and the content of the message with the code',
              'Sending the code to reset the password',
            ],
            [
              '[TO BE COMPLETED: error logging tool and app update provider, if they will be used]',
              '[TO BE COMPLETED: scope of data]',
              'Detecting errors, updates without a new store release',
            ],
          ],
        },
        { type: 'p', text: 'Data may also be passed to public authorities if the law requires us to.' },
        {
          type: 'p',
          text: 'Apple and Google, from whom you download the app, have their own rules on data processing in their stores. We do not pass them the contents of your wardrobe.',
        },
      ],
    },
    {
      n: 7,
      title: 'Transfers of data outside the European Economic Area',
      blocks: [
        {
          type: 'p',
          text: 'Google (Gemini API) and fal.ai may process data outside the EEA, in particular in the United States. Cloudflare stores files in the EU jurisdiction, but is a company of a group headquartered in the USA. Open-Meteo operates outside the EEA.',
        },
        {
          type: 'p',
          text: 'Where data goes outside the EEA, we rely on the following safeguards: [TO BE COMPLETED: for each provider, the basis for the transfer, for example a European Commission adequacy decision (Data Privacy Framework) or standard contractual clauses]. You can obtain a copy of the safeguards by writing to the address in section 2.',
        },
      ],
    },
    {
      n: 8,
      title: 'How long we keep data and how to delete your account',
      blocks: [
        {
          type: 'p',
          text: 'We keep data for as long as you have an account, unless the table in section 3 says otherwise.',
        },
        { type: 'p', text: '**Deleting your account.** You delete your account in the app, in your profile. After that:' },
        {
          type: 'ul',
          items: [
            'your data disappears from the database: profile, clothes, outfits, visualizations, counters and session data,',
            'a special job deletes all your files from storage, within a day at the latest,',
            'AI cost log entries remain, but lose their link to you,',
            'the AI consent and the color analysis result disappear together with the account (we do not keep the photo of your face at all beyond the moment of analysis).',
          ],
        },
        {
          type: 'p',
          text: 'Database backups: [TO BE COMPLETED: whether we make backups, how long we keep them and when the data of a deleted account disappears from them].',
        },
        {
          type: 'p',
          text: 'You can also delete a single garment. We then delete the record and both files (the photo and the cutout).',
        },
        {
          type: 'p',
          text: 'Only what we described in section 4 reaches the AI providers. How long they may keep the data depends on their terms (see section 4).',
        },
      ],
    },
    {
      n: 9,
      title: 'Your rights',
      blocks: [
        { type: 'p', text: 'Under the GDPR, you have the right to:' },
        {
          type: 'ul',
          items: [
            '**access** your data and receive a copy of it,',
            '**rectification** of your data (you can correct most of it yourself in your profile),',
            '**erasure** of your data (the easiest way is to delete your account in the app),',
            '**restriction** of processing,',
            '**data portability**: the data you give us or that arises in your wardrobe, in a commonly used format,',
            '**object** to processing based on our legitimate interest,',
            '**withdraw consent** at any time, without affecting the lawfulness of processing carried out before the withdrawal.',
          ],
        },
        {
          type: 'p',
          text: 'To exercise these rights (other than those you have in the app), write to the address in section 2. We will reply without undue delay, and within a month at the latest. We may ask you to confirm that you own the account.',
        },
        {
          type: 'p',
          text: 'You also have the right to lodge a complaint with a supervisory authority. In Poland, this is the President of the Personal Data Protection Office (Prezes Urzędu Ochrony Danych Osobowych, ul. Stawki 2, 00-193 Warsaw). If you live in another EU country, you can contact the authority in your country.',
        },
      ],
    },
    {
      n: 10,
      title: 'Security',
      blocks: [
        {
          type: 'ul',
          items: [
            'The connection to the server is encrypted (HTTPS).',
            'We store passwords as hashes. We store the refresh token in the database only as a hash. Reusing it after it has already been used invalidates all sessions of the account.',
            'On your phone, the refresh token is kept in the system’s secure storage (Keychain on iOS, Keystore on Android).',
            'Every database query is limited to your account. File names contain the owner’s identifier, and files are accessed through short-lived signed addresses. We do not write them to logs.',
            'Logging in has a limit on attempts and a lock after several failed attempts.',
          ],
        },
        {
          type: 'p',
          text: 'No system is fully secure. If a personal data breach occurs that threatens your rights or freedoms, we will notify you and the supervisory authority within the time limits required by the GDPR.',
        },
      ],
    },
    {
      n: 11,
      title: 'Age',
      blocks: [
        {
          type: 'p',
          text: 'fitit. is for people who are at least 16 years old. When you create an account, we ask for your date of birth, and we will not create an account for a younger person. If we learn that an account belongs to a person under 16, we will delete it together with its data.',
        },
      ],
    },
    {
      n: 12,
      title: 'Automated outfit selection',
      blocks: [
        {
          type: 'p',
          text: 'Outfit suggestions are chosen by an AI model on the basis of descriptions of your clothes, the weather, the occasion and your preferences. We also tailor them to you based on which outfits you rate with a thumbs up or down and which you wear. This is automated processing, but it serves only to give suggestions. We do not make decisions on this basis that produce legal effects concerning you or similarly significantly affect you. We do not build a profile of you for advertising purposes.',
        },
      ],
    },
    {
      n: 13,
      title: 'Phone permissions and tracking tools',
      blocks: [
        { type: 'p', text: 'The app may ask for:' },
        {
          type: 'ul',
          items: [
            '**camera**, to take a photo of a garment or (optionally) a selfie for color analysis,',
            '**access to photos**, to pick photos of clothes or a photo for color analysis from your gallery (the app receives only the photos you pick),',
            '**location**, to check the weather (optional, see section 5).',
          ],
        },
        {
          type: 'p',
          text: 'You can turn off each permission in your phone’s settings. Without the camera, you can pick photos from the gallery, and without location, you can type in a city.',
        },
        {
          type: 'p',
          text: 'The app contains no ads and does not use analytics tools or third-party tracking files.',
        },
      ],
    },
    {
      n: 14,
      title: 'Changes to this policy',
      blocks: [
        {
          type: 'p',
          text: 'We may change this policy, for example when we add a new feature or a new provider. We will tell you about significant changes in the app [TO BE COMPLETED: how far in advance, for example 14 days] before they take effect. The current version and the date from which it applies are always at the top of the document. A change that requires your consent (for example, a new recipient of photos) will take effect with respect to you only once you have given it.',
        },
      ],
    },
    {
      n: 15,
      title: 'Contact',
      blocks: [
        {
          type: 'p',
          text: 'For privacy matters, write to: [TO BE COMPLETED: contact e-mail address]. The controller’s details are in section 2.',
        },
      ],
    },
  ],
};
