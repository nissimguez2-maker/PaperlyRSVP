<?php
/**
 * Title: Modern & minimal — full wedding invitation
 * Slug: paperly-weddings/invite-modern
 * Categories: paperly
 * Description: A clean, contemporary one-page wedding invitation — white space, monochrome palette, uppercase sans headings. Hero, intro, details, schedule, gallery and an RSVP slot. Pair with the "Modern & minimal" style.
 * Keywords: wedding, invitation, rsvp, modern, minimal
 * Viewport Width: 1400
 */
$dir = get_theme_file_uri( 'assets/images' );
?>
<!-- wp:group {"align":"full","style":{"dimensions":{"minHeight":"88svh"},"spacing":{"padding":{"top":"var:preset|spacing|70","bottom":"var:preset|spacing|70","left":"var:preset|spacing|40","right":"var:preset|spacing|40"}}},"backgroundColor":"base","className":"paperly-hero","layout":{"type":"constrained","contentSize":"820px"}} -->
<div class="wp-block-group alignfull paperly-hero has-base-background-color has-background" style="min-height:88svh;padding-top:var(--wp--preset--spacing--70);padding-right:var(--wp--preset--spacing--40);padding-bottom:var(--wp--preset--spacing--70);padding-left:var(--wp--preset--spacing--40)"><!-- wp:paragraph {"align":"center","className":"paperly-eyebrow","textColor":"muted"} -->
<p class="has-text-align-center paperly-eyebrow has-muted-color has-text-color">Save the date</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"textAlign":"center","level":1,"style":{"typography":{"fontSize":"clamp(2.6rem, 8vw, 5.5rem)","textTransform":"uppercase","letterSpacing":"0.14em","fontWeight":"400","lineHeight":"1.1"},"spacing":{"margin":{"top":"1.5rem","bottom":"1.5rem"}}},"fontFamily":"tenor-sans"} -->
<h1 class="wp-block-heading has-text-align-center has-tenor-sans-font-family" style="margin-top:1.5rem;margin-bottom:1.5rem;font-size:clamp(2.6rem, 8vw, 5.5rem);font-weight:400;letter-spacing:0.14em;line-height:1.1;text-transform:uppercase">Olivia &amp; James</h1>
<!-- /wp:heading -->

<!-- wp:separator {"backgroundColor":"contrast"} -->
<hr class="wp-block-separator has-text-color has-contrast-color has-alpha-channel-opacity has-contrast-background-color has-background"/>
<!-- /wp:separator -->

<!-- wp:paragraph {"align":"center","style":{"typography":{"letterSpacing":"0.18em","textTransform":"uppercase","fontSize":"0.85rem"},"spacing":{"margin":{"top":"1.25rem"}}}} -->
<p class="has-text-align-center" style="margin-top:1.25rem;font-size:0.85rem;letter-spacing:0.18em;text-transform:uppercase">12 . 09 . 2026 &nbsp;·&nbsp; New York City</p>
<!-- /wp:paragraph -->

<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"},"style":{"spacing":{"margin":{"top":"var:preset|spacing|50"}}}} -->
<div class="wp-block-buttons" style="margin-top:var(--wp--preset--spacing--50)"><!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="#rsvp">RSVP</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons --></div>
<!-- /wp:group -->

<!-- wp:image {"align":"full","sizeSlug":"full","linkDestination":"none"} -->
<figure class="wp-block-image alignfull size-full"><img src="<?php echo esc_url( $dir . '/hero-modern.svg' ); ?>" alt="Olivia and James"/></figure>
<!-- /wp:image -->

<!-- wp:group {"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|70","bottom":"var:preset|spacing|70"}}},"className":"paperly-reveal","layout":{"type":"constrained","contentSize":"640px"}} -->
<div class="wp-block-group alignfull paperly-reveal" style="padding-top:var(--wp--preset--spacing--70);padding-bottom:var(--wp--preset--spacing--70)"><!-- wp:paragraph {"align":"center","style":{"typography":{"fontSize":"1.3rem","lineHeight":"1.9","fontWeight":"300"}}} -->
<p class="has-text-align-center" style="font-size:1.3rem;font-weight:300;line-height:1.9">Two people, one beginning. We're keeping it simple — good food, good music, and the people we love most. We'd be so glad to have you there.</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group -->

<!-- wp:group {"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|60"}}},"backgroundColor":"surface","layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull has-surface-background-color has-background" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60)"><!-- wp:columns {"style":{"spacing":{"blockGap":{"top":"var:preset|spacing|50","left":"var:preset|spacing|60"}}}} -->
<div class="wp-block-columns"><!-- wp:column -->
<div class="wp-block-column"><!-- wp:paragraph {"align":"center","className":"paperly-eyebrow","textColor":"muted"} -->
<p class="has-text-align-center paperly-eyebrow has-muted-color has-text-color">Ceremony</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"textAlign":"center","level":3,"style":{"typography":{"fontSize":"1.5rem","textTransform":"uppercase","letterSpacing":"0.08em"},"spacing":{"margin":{"top":"0.75rem","bottom":"0.75rem"}}},"fontFamily":"tenor-sans"} -->
<h3 class="wp-block-heading has-text-align-center has-tenor-sans-font-family" style="margin-top:0.75rem;margin-bottom:0.75rem;font-size:1.5rem;letter-spacing:0.08em;text-transform:uppercase">4:00 PM</h3>
<!-- /wp:heading -->

<!-- wp:paragraph {"align":"center","textColor":"muted"} -->
<p class="has-text-align-center has-muted-color has-text-color">The Glasshouse<br>545 W 25th St, New York</p>
<!-- /wp:paragraph --></div>
<!-- /wp:column -->

<!-- wp:column -->
<div class="wp-block-column"><!-- wp:paragraph {"align":"center","className":"paperly-eyebrow","textColor":"muted"} -->
<p class="has-text-align-center paperly-eyebrow has-muted-color has-text-color">Reception</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"textAlign":"center","level":3,"style":{"typography":{"fontSize":"1.5rem","textTransform":"uppercase","letterSpacing":"0.08em"},"spacing":{"margin":{"top":"0.75rem","bottom":"0.75rem"}}},"fontFamily":"tenor-sans"} -->
<h3 class="wp-block-heading has-text-align-center has-tenor-sans-font-family" style="margin-top:0.75rem;margin-bottom:0.75rem;font-size:1.5rem;letter-spacing:0.08em;text-transform:uppercase">6:00 PM</h3>
<!-- /wp:heading -->

<!-- wp:paragraph {"align":"center","textColor":"muted"} -->
<p class="has-text-align-center has-muted-color has-text-color">Rooftop &amp; Lounge<br>Dinner · drinks · dancing</p>
<!-- /wp:paragraph --></div>
<!-- /wp:column --></div>
<!-- /wp:columns --></div>
<!-- /wp:group -->

<!-- wp:group {"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|70","bottom":"var:preset|spacing|70"}}},"className":"paperly-reveal","layout":{"type":"constrained","contentSize":"560px"}} -->
<div class="wp-block-group alignfull paperly-reveal" style="padding-top:var(--wp--preset--spacing--70);padding-bottom:var(--wp--preset--spacing--70)"><!-- wp:heading {"textAlign":"center","style":{"typography":{"textTransform":"uppercase","letterSpacing":"0.1em","fontSize":"1.6rem"},"spacing":{"margin":{"bottom":"var:preset|spacing|50"}}},"fontFamily":"tenor-sans"} -->
<h2 class="wp-block-heading has-text-align-center has-tenor-sans-font-family" style="margin-bottom:var(--wp--preset--spacing--50);font-size:1.6rem;letter-spacing:0.1em;text-transform:uppercase">Schedule</h2>
<!-- /wp:heading -->

<!-- wp:columns {"isStackedOnMobile":false,"style":{"spacing":{"blockGap":{"left":"1.5rem"},"padding":{"bottom":"1rem"}}}} -->
<div class="wp-block-columns" style="padding-bottom:1rem"><!-- wp:column {"width":"34%"} -->
<div class="wp-block-column" style="flex-basis:34%"><!-- wp:paragraph {"style":{"typography":{"letterSpacing":"0.1em"},"spacing":{"margin":{"top":"0"}}},"textColor":"muted"} -->
<p class="has-muted-color has-text-color" style="margin-top:0;letter-spacing:0.1em">3:30 PM</p>
<!-- /wp:paragraph --></div>
<!-- /wp:column -->

<!-- wp:column {"width":"66%"} -->
<div class="wp-block-column" style="flex-basis:66%"><!-- wp:paragraph {"style":{"spacing":{"margin":{"top":"0"}}}} -->
<p style="margin-top:0">Arrival &amp; welcome drinks</p>
<!-- /wp:paragraph --></div>
<!-- /wp:column --></div>
<!-- /wp:columns -->

<!-- wp:columns {"isStackedOnMobile":false,"style":{"spacing":{"blockGap":{"left":"1.5rem"},"padding":{"top":"1rem","bottom":"1rem"}}}} -->
<div class="wp-block-columns" style="padding-top:1rem;padding-bottom:1rem"><!-- wp:column {"width":"34%"} -->
<div class="wp-block-column" style="flex-basis:34%"><!-- wp:paragraph {"style":{"typography":{"letterSpacing":"0.1em"},"spacing":{"margin":{"top":"0"}}},"textColor":"muted"} -->
<p class="has-muted-color has-text-color" style="margin-top:0;letter-spacing:0.1em">4:00 PM</p>
<!-- /wp:paragraph --></div>
<!-- /wp:column -->

<!-- wp:column {"width":"66%"} -->
<div class="wp-block-column" style="flex-basis:66%"><!-- wp:paragraph {"style":{"spacing":{"margin":{"top":"0"}}}} -->
<p style="margin-top:0">Ceremony</p>
<!-- /wp:paragraph --></div>
<!-- /wp:column --></div>
<!-- /wp:columns -->

<!-- wp:columns {"isStackedOnMobile":false,"style":{"spacing":{"blockGap":{"left":"1.5rem"},"padding":{"top":"1rem"}}}} -->
<div class="wp-block-columns" style="padding-top:1rem"><!-- wp:column {"width":"34%"} -->
<div class="wp-block-column" style="flex-basis:34%"><!-- wp:paragraph {"style":{"typography":{"letterSpacing":"0.1em"},"spacing":{"margin":{"top":"0"}}},"textColor":"muted"} -->
<p class="has-muted-color has-text-color" style="margin-top:0;letter-spacing:0.1em">6:00 PM</p>
<!-- /wp:paragraph --></div>
<!-- /wp:column -->

<!-- wp:column {"width":"66%"} -->
<div class="wp-block-column" style="flex-basis:66%"><!-- wp:paragraph {"style":{"spacing":{"margin":{"top":"0"}}}} -->
<p style="margin-top:0">Dinner, toasts &amp; dancing</p>
<!-- /wp:paragraph --></div>
<!-- /wp:column --></div>
<!-- /wp:columns --></div>
<!-- /wp:group -->

<!-- wp:gallery {"columns":3,"linkTo":"none","sizeSlug":"large","align":"wide","style":{"spacing":{"margin":{"top":"0","bottom":"0"}}}} -->
<figure class="wp-block-gallery has-nested-images columns-3 is-cropped alignwide" style="margin-top:0;margin-bottom:0"><!-- wp:image {"sizeSlug":"large","linkDestination":"none"} -->
<figure class="wp-block-image size-large"><img src="<?php echo esc_url( $dir . '/square.svg' ); ?>" alt=""/></figure>
<!-- /wp:image -->

<!-- wp:image {"sizeSlug":"large","linkDestination":"none"} -->
<figure class="wp-block-image size-large"><img src="<?php echo esc_url( $dir . '/square.svg' ); ?>" alt=""/></figure>
<!-- /wp:image -->

<!-- wp:image {"sizeSlug":"large","linkDestination":"none"} -->
<figure class="wp-block-image size-large"><img src="<?php echo esc_url( $dir . '/square.svg' ); ?>" alt=""/></figure>
<!-- /wp:image --></figure>
<!-- /wp:gallery -->

<!-- wp:group {"tagName":"section","align":"full","anchor":"rsvp","style":{"spacing":{"padding":{"top":"var:preset|spacing|70","bottom":"var:preset|spacing|70"}}},"backgroundColor":"contrast","textColor":"base","className":"paperly-reveal","layout":{"type":"constrained","contentSize":"680px"}} -->
<section id="rsvp" class="wp-block-group alignfull paperly-reveal has-base-color has-contrast-background-color has-text-color has-background" style="padding-top:var(--wp--preset--spacing--70);padding-bottom:var(--wp--preset--spacing--70)"><!-- wp:paragraph {"align":"center","className":"paperly-eyebrow","style":{"color":{"text":"#b7b2a6"}}} -->
<p class="has-text-align-center paperly-eyebrow has-text-color" style="color:#b7b2a6">Please reply by 1 August</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"textAlign":"center","style":{"color":{"text":"#ffffff"},"typography":{"textTransform":"uppercase","letterSpacing":"0.1em","fontSize":"1.9rem"},"spacing":{"margin":{"top":"1rem","bottom":"1.5rem"}}},"fontFamily":"tenor-sans"} -->
<h2 class="wp-block-heading has-text-align-center has-text-color has-tenor-sans-font-family" style="color:#ffffff;margin-top:1rem;margin-bottom:1.5rem;font-size:1.9rem;letter-spacing:0.1em;text-transform:uppercase">RSVP</h2>
<!-- /wp:heading -->

<!-- wp:group {"className":"paperly-rsvp","layout":{"type":"constrained","contentSize":"640px"}} -->
<div class="wp-block-group paperly-rsvp"><!-- wp:html -->
<!-- PAPERLY RSVP SLOT — replace the box below with your Tally embed code. Step-by-step: wordpress/TALLY-RSVP.md -->
<div class="paperly-rsvp__placeholder">
  <strong>Your RSVP form goes here.</strong><br>
  Build a free form in Tally (Hebrew / RTL supported), copy its <em>embed</em> code,
  then replace this box with it. Full instructions: TALLY-RSVP.md
</div>
<!-- /wp:html --></div>
<!-- /wp:group --></section>
<!-- /wp:group -->
