<?php
/**
 * Build standalone HTML previews of the three invitation patterns.
 *
 * Patterns are real WordPress pattern files (they call get_theme_file_uri()).
 * Here we stub the few WordPress functions they use, capture each pattern's
 * block markup, strip the block-delimiter comments, and wrap the inner HTML in
 * a self-contained page that loads the same fonts + a preview stylesheet that
 * mirrors theme.json. The result is a faithful, browser-openable preview.
 *
 * Usage:  php wordpress/scripts/build-previews.php
 */

$root      = dirname( __DIR__ );
$themeDir  = $root . '/paperly-weddings';
$outDir    = $root . '/previews';

// --- Minimal WordPress stubs the pattern files rely on -------------------- //
if ( ! function_exists( 'get_theme_file_uri' ) ) {
	function get_theme_file_uri( $path = '' ) {
		// Previews live in /previews; theme assets in /paperly-weddings.
		return '../paperly-weddings/' . ltrim( $path, '/' );
	}
}
if ( ! function_exists( 'esc_url' ) ) {
	function esc_url( $url ) { return $url; }
}

$footer = <<<HTML
<footer class="wp-block-group has-base-color has-contrast-background-color has-text-color has-background" style="background-color:var(--wp--preset--color--contrast);color:var(--wp--preset--color--base);padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--50)">
  <p class="has-text-align-center has-great-vibes-font-family" style="color:#fff;font-size:2.6rem;line-height:1;font-family:var(--wp--preset--font-family--great-vibes)">With love</p>
  <p class="has-text-align-center" style="margin-top:1rem;font-size:0.78rem;letter-spacing:0.28em;text-transform:uppercase">We can't wait to celebrate with you</p>
</footer>
HTML;

$patterns = array(
	'classic'  => array( 'file' => 'invite-classic.php',  'style' => '',                'title' => 'Classic & elegant' ),
	'modern'   => array( 'file' => 'invite-modern.php',   'style' => 'style-modern',    'title' => 'Modern & minimal' ),
	'romantic' => array( 'file' => 'invite-romantic.php', 'style' => 'style-romantic',  'title' => 'Romantic & floral' ),
);

foreach ( $patterns as $key => $p ) {
	// 1. Run the pattern file to get block markup.
	ob_start();
	include $themeDir . '/patterns/' . $p['file'];
	$markup = ob_get_clean();

	// 2. Strip block-delimiter comments, keep the inner HTML.
	$markup = preg_replace( '/<!--\s*\/?wp:.*?-->/s', '', $markup );
	// 3. Drop our internal RSVP slot note comment for a cleaner preview.
	$markup = preg_replace( '/<!--\s*PAPERLY RSVP SLOT.*?-->/s', '', $markup );

	// 4. Wrap.
	$bodyClass = trim( 'paperly-preview ' . $p['style'] );
	$html  = "<!doctype html>\n<html lang=\"en\">\n<head>\n";
	$html .= "<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n";
	$html .= "<title>{$p['title']} — Paperly Weddings preview</title>\n";
	// Self-hosted fonts so the preview is accurate offline. (The WordPress theme
	// itself loads the same families from Google Fonts in production.)
	$html .= "<link rel=\"stylesheet\" href=\"fonts.css\">\n";
	$html .= "<link rel=\"stylesheet\" href=\"_preview.css\">\n";
	$html .= "<link rel=\"stylesheet\" href=\"../paperly-weddings/assets/css/extra.css\">\n";
	$html .= "</head>\n<body class=\"{$bodyClass}\">\n";
	$html .= $markup . "\n" . $footer . "\n";
	$html .= "</body>\n</html>\n";

	file_put_contents( $outDir . "/preview-{$key}.html", $html );
	echo "wrote previews/preview-{$key}.html (" . strlen( $html ) . " bytes)\n";
}
echo "done\n";
