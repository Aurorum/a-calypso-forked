/**
 * External dependencies
 */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { translate } from 'i18n-calypso';
import classNames from 'classnames';

/**
 * Internal dependencies
 */
import { Dialog } from '@automattic/components';
import { recordTracksEvent } from '@automattic/calypso-analytics';
import ExternalLink from 'calypso/components/external-link';
import TrackComponentView from 'calypso/lib/analytics/track-component-view';
import FormLabel from 'calypso/components/forms/form-label';
import FormRadio from 'calypso/components/forms/form-radio';
import {
	getActiveTheme,
	getCanonicalTheme,
	hasActivatedTheme,
	themeHasAutoLoadingHomepage,
	isActivatingTheme,
	isUsingRetiredTheme,
	isThemeActive,
	getPreActivateThemeId,
} from 'calypso/state/themes/selectors';
import { getSelectedSiteId } from 'calypso/state/ui/selectors';
import {
	acceptActivateModalWarning,
	hideActivateModalWarning,
	activate as activateTheme,
} from 'calypso/state/themes/actions';

/**
 * Style dependencies
 */
import './theme-activation-confirmation-modal.scss';

class ThemeActivationConfirmationModal extends Component {
	static propTypes = {
		source: PropTypes.oneOf( [ 'details', 'list', 'upload' ] ).isRequired,
		theme: PropTypes.shape( {
			author: PropTypes.string,
			author_uri: PropTypes.string,
			id: PropTypes.string,
			name: PropTypes.string,
		} ),
		hasActivated: PropTypes.bool.isRequired,
		isActivating: PropTypes.bool.isRequired,
		hasAutoLoadingHomepage: PropTypes.bool,
		siteId: PropTypes.number,
		isCurrentThemeRetired: PropTypes.bool,
		onClose: PropTypes.func,
		installingThemeId: PropTypes.string,
	};

	constructor( props ) {
		super( props );
		this.state = {
			homepageAction: 'keep_current_homepage',
		};
	}

	handleHomepageAction = ( event ) => {
		this.setState( { homepageAction: event.currentTarget.value } );
	};

	closeModalHandler = ( action = 'dismiss' ) => () => {
		const {
			hasAutoLoadingHomepage,
			installingThemeId,
			isCurrentThemeRetired,
			siteId,
			source,
		} = this.props;
		const isSolelyRetiredThemeModal = isCurrentThemeRetired && ! hasAutoLoadingHomepage;
		const tracksPrefix = isSolelyRetiredThemeModal ? 'retired_theme' : 'autoloading_homepage';

		if ( 'activeTheme' === action ) {
			this.props.acceptActivateModalWarning( installingThemeId );
			const keepCurrentHomepage = this.state.homepageAction === 'keep_current_homepage';
			recordTracksEvent( `calypso_theme_${ tracksPrefix }_modal_activate_click`, {
				theme: installingThemeId,
				keep_current_homepage: keepCurrentHomepage,
			} );
			return this.props.activateTheme(
				installingThemeId,
				siteId,
				source,
				false,
				keepCurrentHomepage
			);
		} else if ( 'keepCurrentTheme' === action ) {
			recordTracksEvent( `calypso_theme_${ tracksPrefix }_modal_dismiss`, {
				action: 'button',
				theme: installingThemeId,
			} );
			return this.props.hideActivateModalWarning();
		} else if ( 'dismiss' === action ) {
			recordTracksEvent( `calypso_theme_${ tracksPrefix }_modal_dismiss`, {
				action: 'escape',
				theme: installingThemeId,
			} );
			return this.props.hideActivateModalWarning();
		}
	};

	render() {
		const {
			activeTheme,
			installingTheme,
			hasActivated,
			isActivating,
			hasAutoLoadingHomepage,
			isCurrentTheme,
			isCurrentThemeRetired,
		} = this.props;

		// Nothing to do when it's the current theme.
		if ( isCurrentTheme ) {
			return null;
		}

		// Hide while is activating or when it's activated.
		if ( isActivating || hasActivated ) {
			return null;
		}

		if ( ! installingTheme ) {
			return null;
		}

		const themeName = isCurrentThemeRetired ? activeTheme.name : installingTheme.name;

		const classes = classNames( 'theme-activation-confirmation-modal', {
			'is-solely-retired-modal': isCurrentThemeRetired && ! hasAutoLoadingHomepage,
		} );

		const retiredMessage = translate(
			'Your active theme {{strong}}%(themeName)s{{/strong}} is retired. ' +
				'If you activate a new theme, you might not be able to switch back to %(themeName)s. {{supportLink/}}',
			{
				args: {
					themeName,
				},
				components: {
					strong: <strong />,
					supportLink: (
						<ExternalLink
							target="_blank"
							icon
							href={ 'https://wordpress.com/support/themes/#retired-themes' }
						>
							{ translate( 'Learn more.' ) }
						</ExternalLink>
					),
				},
			}
		);

		let dialogHeading;

		if ( hasAutoLoadingHomepage ) {
			dialogHeading = translate( 'How would you like to use %(themeName)s on your site?', {
				args: { themeName: installingTheme.name },
			} );
		} else if ( isCurrentThemeRetired ) {
			dialogHeading = retiredMessage;
		}

		return (
			<Dialog
				className={ classes }
				isVisible
				baseClassName="theme-activation-confirmation-modal__dialog dialog"
				buttons={ [
					{
						action: 'keepCurrentTheme',
						label: translate( 'Keep my current theme' ),
						isPrimary: false,
						onClick: this.closeModalHandler( 'keepCurrentTheme' ),
					},
					{
						action: 'activeTheme',
						label: translate( 'Activate %(themeName)s', {
							args: { themeName: installingTheme.name },
						} ),
						isPrimary: true,
						onClick: this.closeModalHandler( 'activeTheme' ),
					},
				] }
				onClose={ this.closeModalHandler( 'dismiss' ) }
			>
				<TrackComponentView
					eventName={
						isCurrentThemeRetired && hasAutoLoadingHomepage
							? 'calypso_theme_activation_retired_and_autoloading_homepage_confirmation_modal_view'
							: 'calypso_theme_autoloading_homepage_modal_view'
					}
					eventProperties={ {
						theme: installingTheme.id,
					} }
				/>
				<div>
					<h1 className="theme-activation-confirmation-modal__title">{ dialogHeading }</h1>
					{ hasAutoLoadingHomepage && (
						<div>
							<FormLabel>
								<FormRadio
									value="keep_current_homepage"
									checked={ 'keep_current_homepage' === this.state.homepageAction }
									onChange={ this.handleHomepageAction }
									label={ translate(
										'Switch to %(themeName)s without changing the homepage content.',
										{
											args: { themeName: installingTheme.name },
										}
									) }
								/>
							</FormLabel>
							<FormLabel>
								<FormRadio
									value="use_new_homepage"
									checked={ 'use_new_homepage' === this.state.homepageAction }
									onChange={ this.handleHomepageAction }
									label={ translate(
										'Replace the homepage content with the %(themeName)s demo content. The existing homepage will be saved as a draft under Pages → Drafts.',
										{
											args: { themeName: installingTheme.name },
										}
									) }
								/>
							</FormLabel>
						</div>
					) }
					{ hasAutoLoadingHomepage && isCurrentThemeRetired && (
						<p className="theme-activation-confirmation-modal__retired-message">
							{ retiredMessage }
						</p>
					) }
				</div>
			</Dialog>
		);
	}
}

export default connect(
	( state ) => {
		const siteId = getSelectedSiteId( state );
		const installingThemeId = getPreActivateThemeId( state );
		const activeThemeId = getActiveTheme( state, siteId );

		return {
			siteId,
			activeThemeId,
			installingThemeId,
			activeTheme: activeThemeId && getCanonicalTheme( state, siteId, activeThemeId ),
			installingTheme: installingThemeId && getCanonicalTheme( state, siteId, installingThemeId ),
			isActivating: !! isActivatingTheme( state, siteId ),
			hasActivated: !! hasActivatedTheme( state, siteId ),
			hasAutoLoadingHomepage: themeHasAutoLoadingHomepage( state, installingThemeId ),
			isCurrentTheme: isThemeActive( state, installingThemeId, siteId ),
			isCurrentThemeRetired: isUsingRetiredTheme( state, siteId ),
		};
	},
	{
		acceptActivateModalWarning,
		hideActivateModalWarning,
		activateTheme,
		recordTracksEvent,
	}
)( ThemeActivationConfirmationModal );
