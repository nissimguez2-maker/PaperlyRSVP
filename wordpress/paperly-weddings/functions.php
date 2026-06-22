<?php
/**
 * Paperly Weddings — theme bootstrap.
 *
 * Block themes do most of their work through theme.json, templates and
 * patterns. This file only wires up the few things PHP still owns:
 *  - loading the web fonts the three looks use,
 *  - a small stylesheet of extras (RSVP slot, gentle reveal animation),
 *  - a "Paperly" pattern category so the three invitations are easy to find,
 *  - editor styles so the editor preview matches the live site.
 *
 * @package Paperly_Weddings
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // No direct access.
}

if ( ! function_exists( 'paperly_weddings_setup' ) ) {
	/**
	 * Basic theme supports. Most are implicit for block themes, but declaring
	 * them keeps the theme robust across hosts and WordPress versions.
	 */
	function paperly_weddings_setup() {
		load_theme_textdomain( 'paperly-weddings', get_template_directory() . '/languages' );

		add_theme_support( 'title-tag' );
		add_theme_support( 'post-thumbnails' );
		add_theme_support( 'responsive-embeds' );
		add_theme_support( 'editor-styles' );
		add_theme_support( 'html5', array( 'style', 'script', 'comment-form', 'comment-list', 'gallery', 'caption' ) );
		add_theme_support( 'wp-block-styles' );

		// Make the extras stylesheet apply inside the block editor too.
		add_editor_style( 'assets/css/extra.css' );
	}
}
add_action( 'after_setup_theme', 'paperly_weddings_setup' );

if ( ! function_exists( 'paperly_weddings_assets' ) ) {
	/**
	 * Front-end fonts + extras. All three looks share one font request so a new
	 * site only ever makes a single Google Fonts call regardless of the look.
	 */
	function paperly_weddings_assets() {
		$fonts = 'https://fonts.googleapis.com/css2'
			. '?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400'
			. '&family=EB+Garamond:wght@400;500;600'
			. '&family=Great+Vibes'
			. '&family=Tenor+Sans'
			. '&family=Inter:wght@300;400;500;600'
			. '&family=Jost:wght@300;400;500;600'
			. '&family=Pinyon+Script'
			. '&family=Mulish:wght@300;400;500;600'
			. '&display=swap';

		wp_enqueue_style( 'paperly-fonts-preconnect', 'https://fonts.gstatic.com', array(), null );
		wp_enqueue_style( 'paperly-fonts', $fonts, array(), null );

		wp_enqueue_style(
			'paperly-extra',
			get_theme_file_uri( 'assets/css/extra.css' ),
			array(),
			wp_get_theme()->get( 'Version' )
		);
	}
}
add_action( 'wp_enqueue_scripts', 'paperly_weddings_assets' );

if ( ! function_exists( 'paperly_weddings_editor_fonts' ) ) {
	/**
	 * Load the same fonts inside the editor iframe so the editor preview looks
	 * like the published page.
	 */
	function paperly_weddings_editor_fonts() {
		$fonts = 'https://fonts.googleapis.com/css2'
			. '?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400'
			. '&family=EB+Garamond:wght@400;500;600'
			. '&family=Great+Vibes&family=Tenor+Sans'
			. '&family=Inter:wght@300;400;500;600'
			. '&family=Jost:wght@300;400;500;600'
			. '&family=Pinyon+Script'
			. '&family=Mulish:wght@300;400;500;600&display=swap';
		wp_enqueue_style( 'paperly-fonts-editor', $fonts, array(), null );
	}
}
add_action( 'enqueue_block_assets', 'paperly_weddings_editor_fonts' );

if ( ! function_exists( 'paperly_weddings_pattern_category' ) ) {
	/**
	 * A dedicated category so the three full-page invitations sit together in
	 * the editor's pattern inserter under "Paperly — wedding invitations".
	 */
	function paperly_weddings_pattern_category() {
		register_block_pattern_category(
			'paperly',
			array(
				'label'       => __( 'Paperly — wedding invitations', 'paperly-weddings' ),
				'description' => __( 'Full one-page wedding invitation layouts. Insert one, then swap the names, dates, photos and RSVP form.', 'paperly-weddings' ),
			)
		);
	}
}
add_action( 'init', 'paperly_weddings_pattern_category' );
