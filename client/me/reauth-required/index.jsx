/**
 * External dependencies
 */
import { connect } from 'react-redux';
import createReactClass from 'create-react-class';
import debugFactory from 'debug';
import { localize } from 'i18n-calypso';
import React from 'react';
import classNames from 'classnames';

const debug = debugFactory( 'calypso:me:reauth-required' );

/**
 * Internal Dependencies
 */
import Dialog from 'components/dialog';
import FormButton from 'components/forms/form-button';
import FormButtonsBar from 'components/forms/form-buttons-bar';
import FormCheckbox from 'components/forms/form-checkbox';
import FormFieldset from 'components/forms/form-fieldset';
import FormInputValidation from 'components/forms/form-input-validation';
import FormLabel from 'components/forms/form-label';
import FormVerificationCodeInput from 'components/forms/form-verification-code-input';
import Notice from 'components/notice';
/* eslint-disable no-restricted-imports */
import observe from 'lib/mixins/data-observe';
/* eslint-enable no-restricted-imports */
import { recordGoogleEvent } from 'state/analytics/actions';
import userUtilities from 'lib/user/utils';

/**
 * Style dependencies
 */
import './style.scss';

// autofocus is used for tracking purposes, not an a11y issue
/* eslint-disable jsx-a11y/no-autofocus */

const ReauthRequired = createReactClass( {
	displayName: 'ReauthRequired',
	mixins: [ observe( 'twoStepAuthorization' ) ],

	getInitialState: function() {
		return {
			remember2fa: false, // Should the 2fa be remembered for 30 days?
			code: '', // User's generated 2fa code
			smsRequestsAllowed: true, // Can the user request another SMS code?
			smsCodeSent: false,
		};
	},

	getClickHandler( action, callback ) {
		return () => {
			this.props.recordGoogleEvent( 'Me', 'Clicked on ' + action );

			if ( callback ) {
				callback();
			}
		};
	},

	getCheckboxHandler( checkboxName ) {
		return event => {
			const action = 'Clicked ' + checkboxName + ' checkbox';
			const value = event.target.checked ? 1 : 0;

			this.props.recordGoogleEvent( 'Me', action, 'checked', value );
		};
	},

	getFocusHandler( action ) {
		return () => this.props.recordGoogleEvent( 'Me', 'Focused on ' + action );
	},

	getCodeMessage: function() {
		if ( this.props.twoStepAuthorization.isTwoStepSMSEnabled() ) {
			return this.props.translate(
				'Press the button below to request an SMS verification code. ' +
					'Once you receive our text message at your phone number ending with ' +
					'{{strong}}%(smsLastFour)s{{/strong}} , enter the code below.',
				{
					args: {
						smsLastFour: this.props.twoStepAuthorization.getSMSLastFour(),
					},
					components: {
						strong: <strong />,
					},
				}
			);
		}

		return this.props.translate(
			'Please enter the verification code generated by your authenticator app.'
		);
	},

	submitForm: function( event ) {
		event.preventDefault();
		this.setState( { validatingCode: true } );

		this.props.twoStepAuthorization.validateCode(
			{
				code: this.state.code,
				remember2fa: this.state.remember2fa,
			},
			function( error, data ) {
				this.setState( { validatingCode: false } );
				if ( error ) {
					debug( 'There was an error validating that code: ' + JSON.stringify( error ) );
				} else {
					debug( 'The code validated!' + JSON.stringify( data ) );
				}
			}.bind( this )
		);
	},

	codeRequestTimer: false,

	allowSMSRequests: function() {
		this.setState( { smsRequestsAllowed: true } );
	},

	sendSMSCode: function() {
		this.setState( { smsRequestsAllowed: false, smsCodeSent: true } );
		this.codeRequestTimer = setTimeout( this.allowSMSRequests, 60000 );

		this.props.twoStepAuthorization.sendSMSCode( function( error, data ) {
			if ( ! error && data.sent ) {
				debug( 'SMS code successfully sent' );

			} else {
				debug( 'There was a failure sending the SMS code.' );
			}
		} );
	},
	
	sendSMSClick: function this.props.twoStepAuthorization.sent() {
		return null;
	},
	
	preValidateAuthCode: function() {
		return this.state.code.length && this.state.code.length > 5;
	},

	renderSendSMSButton: function() {
		const { smsRequestsAllowed, smsCodeSent } = this.state;

		const [ clickAction, buttonLabel ] = ! smsCodeSent
			? [ 'Send SMS Code Button on Reauth Required', this.props.translate( 'Send SMS Code' ) ]
			: [ 'Resend SMS Code Button on Reauth Required', this.props.translate( 'Resend SMS Code' ) ];
	
		return (
			<FormButton
				disabled={ ! smsRequestsAllowed }
				isPrimary={ false }
				onClick={ this.getClickHandler( clickAction, this.sendSMSCode, this.sendSMSClick ) }
				type="button"
				className="reauth-required__send-sms-code"
			>
				{ buttonLabel }
			</FormButton>
		);
	},

	renderFailedValidationMsg: function() {
		if ( ! this.props.twoStepAuthorization.codeValidationFailed() ) {
			return null;
		}

		return (
			<FormInputValidation
				isError
				text={ this.props.translate( 'You entered an invalid code. Please try again.' ) }
			/>
		);
	},

	renderSMSResendThrottled: function() {
		if ( ! this.props.twoStepAuthorization.isSMSResendThrottled() ) {
			return null;
		}

		return (
			<div className="reauth-required__send-sms-throttled">
				<Notice
					showDismiss={ false }
					text={ this.props.translate(
						'SMS codes are limited to once per minute. Please wait and try again.'
					) }
				/>
			</div>
		);
	},

	render: function() {
		const method = this.props.twoStepAuthorization.isTwoStepSMSEnabled() ? 'sms' : 'app';
		
		const methodClasses = classNames( {
					'reauth-required__sms-only': this.props.twoStepAuthorization.isTwoStepSMSEnabled(),
			} );
		
		const verifyClasses = classNames( {
					'is-visible': this.props.twoStepAuthorization.sent(),
			} );
		
		return (
			<Dialog
				autoFocus={ false }
				className={ classNames( 'reauth-required__dialog', methodClasses, this.props.className ) }
				isFullScreen={ false }
				isVisible={ this.props.twoStepAuthorization.isReauthRequired() }
				buttons={ null }
				onClose={ null }
			>
				<p>{ this.getCodeMessage() }</p>
				
				<div className="reauth-required__centre"> { this.renderSendSMSButton() } </div>

				<p>
					<a
						className="reauth-required__sign-out"
						onClick={ this.getClickHandler( 'Reauth Required Log Out Link', userUtilities.logout ) }
					>
						{ this.props.translate( 'Not you? Log out' ) }
					</a>
				</p>

				<form onSubmit={ this.submitForm }>
					<FormFieldset>
						<FormLabel htmlFor="code">{ this.props.translate( 'Verification Code' ) }</FormLabel>
						<FormVerificationCodeInput
							autoFocus
							id="code"
							isError={ this.props.twoStepAuthorization.codeValidationFailed() }
							name="code"
							method={ method }
							onFocus={ this.getFocusHandler( 'Reauth Required Verification Code Field' ) }
							value={ this.state.code }
							onChange={ this.handleChange }
						/>

						{ this.renderFailedValidationMsg() }
					</FormFieldset>

					<FormFieldset>
						<FormLabel>
							<FormCheckbox
								id="remember2fa"
								name="remember2fa"
								onClick={ this.getCheckboxHandler( 'Remember 2fa' ) }
								checked={ this.state.remember2fa }
								onChange={ this.handleCheckedChange }
							/>
							<span>{ this.props.translate( 'Remember for 30 days.' ) }</span>
						</FormLabel>
					</FormFieldset>

					{ this.renderSMSResendThrottled() }
					
						<FormButton
							disabled={ this.state.validatingCode || ! this.preValidateAuthCode() }
							onClick={ this.getClickHandler( 'Submit Validation Code on Reauth Required' ) }
							className={ classNames( 'reauth-required__verification', verifyClasses, this.props.className ) }
						>
							{ this.props.translate( 'Verify' ) }
						</FormButton>
					
				</form>
			</Dialog>
		);
	},

	handleChange( e ) {
		const { name, value } = e.currentTarget;
		this.setState( { [ name ]: value } );
	},

	handleCheckedChange( e ) {
		const { name, checked } = e.currentTarget;
		this.setState( { [ name ]: checked } );
	},
} );
/* eslint-enable jsx-a11y/no-autofocus */

export default connect(
	null,
	{ recordGoogleEvent }
)( localize( ReauthRequired ) );
