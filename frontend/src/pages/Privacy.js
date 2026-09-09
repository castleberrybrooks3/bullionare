import { useNavigate } from "react-router-dom";
import "./Legal.css";

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="legal-page">
      <div className="legal-card">
  <button
    type="button"
    className="legal-back-button"
    onClick={() => navigate(-1)}
  >
    ← Back
  </button>

  <h1>Privacy Policy</h1>
        <p className="legal-meta">Effective Date: August 8, 2026</p>
        <p className="legal-meta">Last Updated: August 8, 2026</p>

        <section>
          <h2>1. Overview and Scope</h2>

          <p>
            Bullionaire IQ ("Bullionaire," "we," "our," or "us") respects your
            privacy and is committed to handling personal information
            responsibly.
          </p>

          <p>
            This Privacy Policy explains how we collect, use, disclose, retain,
            and protect personal information when you access or use Bullionaire
            IQ, bullionaireiq.com, and any related websites, applications,
            software, accounts, products, features, communications,
            subscriptions, and services that reference this Privacy Policy
            (collectively, the "Services").
          </p>

          <p>
            This Privacy Policy also explains certain rights and choices that
            may be available to you depending on where you live and the laws
            that apply to our processing of your information.
          </p>

          <p>
            This Privacy Policy applies to personal information that Bullionaire
            controls or processes in connection with the Services. It does not
            apply to the independent privacy practices of third-party
            prediction markets, exchanges, brokers, financial institutions,
            websites, applications, or other services that Bullionaire does not
            control.
          </p>

          <p>
            By using the Services, you acknowledge the data practices described
            in this Privacy Policy. Where applicable law requires consent for a
            particular processing activity, we will request that consent
            separately.
          </p>
        </section>

        <section>
          <h2>2. Personal Information We Collect</h2>

          <p>
            The personal information we collect depends on how you interact
            with Bullionaire and which Services you use. We may collect the
            following categories of information.
          </p>

          <h3>2.1 Account and Contact Information</h3>

          <p>
            When you create or manage a Bullionaire account, we may collect
            information such as:
          </p>

          <ul>
            <li>Your name</li>
            <li>Email address</li>
            <li>Username or account identifier</li>
            <li>Account type</li>
            <li>Subscription or membership status</li>
            <li>Account creation date and related account information</li>
            <li>
              Preferences and settings associated with your Bullionaire account
            </li>
          </ul>

          <h3>2.2 Authentication and Security Information</h3>

          <p>
            We and our authentication providers may process information
            necessary to authenticate and secure your account, including:
          </p>

          <ul>
            <li>Login identifiers</li>
            <li>Authentication tokens</li>
            <li>Session information</li>
            <li>Password-related authentication data</li>
            <li>Login history</li>
            <li>Security events</li>
            <li>Account recovery information</li>
          </ul>

          <p>
            Passwords may be processed through authentication infrastructure
            designed to store or verify credentials securely. Bullionaire does
            not need access to your plaintext password in order to provide the
            Services.
          </p>

          <h3>2.3 Usage and Activity Information</h3>

          <p>
            We may collect information about how you interact with Bullionaire,
            including:
          </p>

          <ul>
            <li>Pages and screens you view</li>
            <li>Features you access</li>
            <li>Searches you perform</li>
            <li>Filters and sorting options you use</li>
            <li>Markets, securities, or assets you view</li>
            <li>Watchlists, alerts, or saved preferences you create</li>
            <li>
              Interactions with prediction-market comparisons or opportunity
              displays
            </li>
            <li>Clicks and navigation activity</li>
            <li>Session duration and timestamps</li>
            <li>Error, crash, and performance information</li>
            <li>General feature usage and engagement information</li>
          </ul>

          <p>
            Information indicating that you viewed, searched for, saved, or
            interacted with a security, market, strategy, or
            prediction-market contract does not necessarily mean that you own
            that asset, entered that transaction, or hold that financial
            position.
          </p>

          <h3>2.4 Device, Network, and Technical Information</h3>

          <p>
            When you access the Services, we or our service providers may
            automatically receive technical information such as:
          </p>

          <ul>
            <li>Internet Protocol ("IP") address</li>
            <li>Browser type and version</li>
            <li>Device type</li>
            <li>Operating system</li>
            <li>Device or browser identifiers</li>
            <li>Language settings</li>
            <li>Time zone</li>
            <li>Referral and exit pages</li>
            <li>General network information</li>
            <li>Approximate location derived from an IP address</li>
            <li>Request and response timestamps</li>
            <li>Log and diagnostic information</li>
          </ul>

          <p>
            Unless expressly disclosed and permitted, Bullionaire does not
            intentionally collect precise GPS-level geolocation information
            through the core Services.
          </p>

          <h3>2.5 Communications and Support Information</h3>

          <p>
            If you contact us, respond to a survey, request support, report an
            issue, submit feedback, or otherwise communicate with Bullionaire,
            we may collect the information contained in or associated with that
            communication, including:
          </p>

          <ul>
            <li>Your name and email address</li>
            <li>The content of your message</li>
            <li>Attachments or screenshots you choose to provide</li>
            <li>Support history</li>
            <li>Feedback and feature requests</li>
            <li>Information necessary to investigate or resolve your request</li>
          </ul>

          <h3>2.6 Subscription, Transaction, and Payment Information</h3>

          <p>
            If Bullionaire offers paid Services and you purchase a
            subscription or other product, we may collect or receive
            information associated with the transaction, such as:
          </p>

          <ul>
            <li>Subscription plan</li>
            <li>Purchase amount</li>
            <li>Billing status</li>
            <li>Transaction date</li>
            <li>Payment status</li>
            <li>Refund or cancellation information</li>
            <li>Limited payment-method information</li>
          </ul>

          <p>
            Payment-card information may be collected and processed directly by
            a third-party payment processor. Where a payment processor handles
            payment credentials directly, Bullionaire may receive limited
            information such as a payment token, payment status, card brand, or
            the last digits of a payment method rather than the complete payment
            card number.
          </p>

          <h3>2.7 Marketing and Communication Preferences</h3>

          <p>
            We may collect information about your communication preferences,
            including whether you have subscribed to, opened, interacted with,
            or unsubscribed from certain Bullionaire communications.
          </p>

          <h3>2.8 Information From Optional Integrations</h3>

          <p>
            Bullionaire may offer optional integrations with third-party
            services in the future. If you affirmatively choose to connect a
            third-party account or service to Bullionaire, we may receive
            information authorized by you and permitted by that integration.
          </p>

          <p>
            The types of information available through an integration will
            depend on the integration and the permissions you grant.
          </p>

          <p>
            If an integration involves information that requires additional
            notice or consent under applicable law, we may provide additional
            disclosures before the integration is activated.
          </p>
        </section>

        <section>
          <h2>3. Information We Generally Do Not Seek to Collect</h2>

          <p>
            Bullionaire does not generally require users of the core Services
            to provide highly sensitive personal information such as:
          </p>

          <ul>
            <li>Social Security numbers</li>
            <li>Government identification numbers</li>
            <li>Passport numbers</li>
            <li>Biometric identifiers used to uniquely identify a person</li>
            <li>Genetic information</li>
            <li>Health or medical records</li>
            <li>Precise GPS geolocation</li>
            <li>
              Information concerning racial or ethnic origin, religious
              beliefs, sexual orientation, or similar sensitive characteristics
            </li>
          </ul>

          <p>
            Please do not send this type of information to Bullionaire unless
            we specifically request it for a legitimate purpose and provide any
            legally required notice or consent process.
          </p>

          <p>
            Payment information and authentication information may qualify as
            sensitive information under certain privacy laws and are handled as
            described elsewhere in this Privacy Policy.
          </p>
        </section>

        <section>
          <h2>4. Prediction-Market and Financial-Market Data</h2>

          <p>
            A significant portion of the information processed by Bullionaire
            concerns markets rather than individual Bullionaire users.
          </p>

          <p>
            Bullionaire may obtain financial-market, corporate,
            prediction-market, order-book, pricing, volume, liquidity,
            settlement, contract, event, and similar information from
            third-party APIs, public sources, exchanges, prediction markets,
            filings, databases, and data providers.
          </p>

          <p>
            Market information concerning a security, company, event, contract,
            bid, ask, price, volume, or other market characteristic generally
            is not personal information about a Bullionaire user merely because
            Bullionaire collects or analyzes it.
          </p>

          <p>
            However, your interactions with market information may constitute
            personal information when they can reasonably be associated with
            your account, device, or identity.
          </p>

          <p>
            For example, Bullionaire may be able to associate a saved market,
            watchlist, alert, search, or viewed security with your Bullionaire
            account.
          </p>
        </section>

        <section>
          <h2>5. Third-Party Trading and Prediction-Market Accounts</h2>

          <p>
            Bullionaire does not operate the independent prediction markets,
            exchanges, brokers, or other trading venues whose information may
            be displayed through the Services.
          </p>

          <p>
            Merely viewing third-party market information through Bullionaire
            does not ordinarily require Bullionaire to provide your identity to
            the applicable market or exchange.
          </p>

          <p>
            If you leave Bullionaire and interact directly with a third-party
            venue, information you provide to that venue is governed by the
            venue's own privacy policy and terms.
          </p>

          <p>
            If Bullionaire later offers an optional account connection,
            execution integration, referral integration, or similar feature,
            additional information may be exchanged with the third party at
            your direction. We will provide additional disclosures where
            required before collecting information materially different from
            the practices described in this Privacy Policy.
          </p>

          <p>
            You should never submit passwords or credentials for a third-party
            financial or prediction-market account into a general Bullionaire
            search box, support message, or other field that is not expressly
            designed for that purpose.
          </p>
        </section>

        <section>
          <h2>6. How We Collect Information</h2>

          <p>We may collect personal information from several sources.</p>

          <h3>6.1 Directly From You</h3>

          <p>
            We collect information that you provide when you create an account,
            configure preferences, contact us, subscribe to a Service, submit a
            request, or otherwise interact with Bullionaire.
          </p>

          <h3>6.2 Automatically Through the Services</h3>

          <p>
            We may automatically collect technical, usage, security, and
            diagnostic information when you visit or interact with Bullionaire.
          </p>

          <h3>6.3 From Service Providers</h3>

          <p>
            We may receive information from providers that support functions
            such as hosting, authentication, database infrastructure,
            communications, security, analytics, performance monitoring,
            customer support, and payment processing.
          </p>

          <h3>6.4 From Third-Party and Public Sources</h3>

          <p>
            We may obtain information from publicly available sources,
            financial data providers, public filings, third-party APIs,
            prediction markets, exchanges, and other sources used to operate
            Bullionaire's market-information and research features.
          </p>
        </section>

        <section>
          <h2>7. How We Use Personal Information</h2>

          <p>
            We may use personal information for purposes including the
            following:
          </p>

          <ul>
            <li>Providing and operating the Services</li>
            <li>Creating and maintaining user accounts</li>
            <li>Authenticating users</li>
            <li>Maintaining account security</li>
            <li>Remembering preferences and settings</li>
            <li>Providing watchlists, alerts, and saved features</li>
            <li>
              Personalizing the functionality of the Services based on user
              settings and interactions
            </li>
            <li>Processing subscriptions and transactions</li>
            <li>Providing customer support</li>
            <li>Responding to questions and requests</li>
            <li>Sending administrative and account-related communications</li>
            <li>Sending communications you request or consent to receive</li>
            <li>
              Measuring performance, engagement, reliability, and feature usage
            </li>
            <li>Developing and improving Bullionaire</li>
            <li>Testing new features and functionality</li>
            <li>Debugging errors and diagnosing technical issues</li>
            <li>Maintaining infrastructure and system reliability</li>
            <li>Detecting and preventing fraud, abuse, or unauthorized access</li>
            <li>Protecting users, Bullionaire, and third parties</li>
            <li>Enforcing our Terms of Service and other policies</li>
            <li>Complying with legal and regulatory obligations</li>
            <li>Responding to lawful governmental or legal requests</li>
            <li>Establishing, exercising, or defending legal claims</li>
            <li>
              Conducting internal analytics, research, and business planning
            </li>
          </ul>

          <p>
            We may also use information for another purpose that is compatible
            with the purpose for which it was collected or as otherwise
            permitted by applicable law.
          </p>

          <p>
            Where applicable law requires consent for a materially different or
            incompatible purpose, we will seek appropriate consent before
            engaging in that processing.
          </p>
        </section>

        <section>
          <h2>8. Analytics and Product Improvement</h2>

          <p>
            Bullionaire may analyze how users interact with the Services in
            order to understand product performance, improve features, diagnose
            problems, evaluate engagement, and make the Services more useful.
          </p>

          <p>
            This analysis may involve information such as pages visited,
            features used, session information, device information, search
            activity, and interactions with market or analytical tools.
          </p>

          <p>
            We may use service providers to assist with analytics,
            infrastructure monitoring, performance measurement, and error
            detection.
          </p>

          <p>
            Where reasonably practicable and appropriate, we may use aggregated,
            statistical, or deidentified information rather than directly
            identifying information for analytics and product-development
            purposes.
          </p>
        </section>

        <section>
          <h2>9. Automated Analytics and Profiling</h2>

          <p>
            Bullionaire uses software, algorithms, models, and automated
            processes to analyze financial and prediction-market information
            and to operate product features.
          </p>

          <p>
            Bullionaire may also use automated systems to organize content,
            detect technical problems, identify suspicious account activity, or
            personalize aspects of the user experience.
          </p>

          <p>
            Bullionaire does not currently use personal information to make
            solely automated decisions about users that determine eligibility
            for employment, housing, insurance, credit, lending, education,
            health care, or another comparable service that produces a legal or
            similarly significant effect concerning the user.
          </p>

          <p>
            If our practices materially change in a manner that creates
            additional rights under applicable privacy law, we will provide
            appropriate disclosures and choices as required by law.
          </p>
        </section>

        <section>
          <h2>10. Cookies and Similar Technologies</h2>

          <p>
            Bullionaire and our service providers may use cookies, local
            storage, pixels, software development kits, log files, and similar
            technologies in connection with the Services.
          </p>

          <p>These technologies may be used to:</p>

          <ul>
            <li>Keep users signed in</li>
            <li>Maintain secure sessions</li>
            <li>Remember preferences</li>
            <li>Enable core site functionality</li>
            <li>Understand how the Services are used</li>
            <li>Measure performance</li>
            <li>Detect errors</li>
            <li>Prevent fraud and abuse</li>
            <li>Improve the Services</li>
          </ul>

          <p>
            Some cookies are necessary for the operation and security of the
            Services. Other technologies may be used for analytics or similar
            purposes.
          </p>

          <p>
            Your browser may allow you to block or delete cookies. Disabling
            certain cookies or storage technologies may prevent some portions
            of Bullionaire from functioning correctly.
          </p>
        </section>

        <section>
          <h2>11. Do Not Track and Privacy Preference Signals</h2>

          <p>
            Some browsers provide a legacy "Do Not Track" ("DNT") setting.
            Because there is not a single universally accepted standard
            governing how websites must respond to all DNT signals,
            Bullionaire does not necessarily respond to legacy DNT signals in a
            uniform manner.
          </p>

          <p>
            Where applicable law requires Bullionaire to recognize a qualifying
            browser-based or device-based opt-out preference signal, authorized
            agent mechanism, or similar legally recognized privacy control, we
            will process qualifying signals as required by applicable law.
          </p>

          <p>
            A privacy preference signal may apply only to the browser or device
            from which the signal is sent unless applicable law requires
            otherwise or the signal can reasonably be associated with your
            account.
          </p>
        </section>

        <section>
          <h2>12. Sale of Personal Information and Targeted Advertising</h2>

          <p>
            As of the Effective Date of this Privacy Policy, Bullionaire does
            not sell personal information to third parties in exchange for
            monetary consideration.
          </p>

          <p>
            Bullionaire also does not currently process personal information
            obtained through the core Services for cross-context behavioral or
            targeted advertising as part of our core business model.
          </p>

          <p>
            Disclosures to vendors that process information on our behalf to
            provide hosting, authentication, security, communications,
            analytics, payment processing, or similar operational services are
            described in this Privacy Policy and are not intended by Bullionaire
            to constitute sales of personal information.
          </p>

          <p>
            Privacy laws may define terms such as "sale," "sharing," and
            "targeted advertising" differently from their ordinary meanings.
            If Bullionaire introduces a practice that qualifies as a sale,
            sharing, or targeted-advertising activity under applicable law, we
            will provide any legally required disclosures and opt-out mechanisms
            before or when required.
          </p>
        </section>

        <section>
          <h2>13. How We Disclose Personal Information</h2>

          <p>
            Bullionaire may disclose personal information in the circumstances
            described below.
          </p>

          <h3>13.1 Service Providers and Processors</h3>

          <p>
            We may provide personal information to vendors and service
            providers that perform services for Bullionaire, including
            providers of:
          </p>

          <ul>
            <li>Cloud hosting and infrastructure</li>
            <li>Database services</li>
            <li>Authentication and account management</li>
            <li>Email and communications</li>
            <li>Security and fraud prevention</li>
            <li>Analytics and performance monitoring</li>
            <li>Error tracking and diagnostics</li>
            <li>Customer support</li>
            <li>Payment processing</li>
            <li>Professional and technical services</li>
          </ul>

          <p>
            These providers may process personal information for purposes of
            providing their services to Bullionaire and subject to applicable
            contractual and legal obligations.
          </p>

          <h3>13.2 At Your Direction</h3>

          <p>
            We may disclose information when you request, direct, authorize, or
            consent to the disclosure, including through an optional third-party
            integration.
          </p>

          <h3>13.3 Legal Compliance and Government Requests</h3>

          <p>
            We may preserve, access, or disclose information if we reasonably
            believe doing so is necessary or appropriate to:
          </p>

          <ul>
            <li>Comply with applicable law or regulation</li>
            <li>
              Respond to a subpoena, court order, warrant, or other valid legal
              process
            </li>
            <li>Respond to a lawful governmental request</li>
            <li>Meet regulatory or reporting obligations</li>
            <li>Establish, exercise, or defend legal claims</li>
          </ul>

          <p>
            Where legally permitted and appropriate, Bullionaire may evaluate
            legal requests to determine whether they are valid and properly
            scoped.
          </p>

          <h3>13.4 Safety, Security, and Protection of Rights</h3>

          <p>
            We may disclose information where reasonably necessary to detect,
            prevent, investigate, or address:
          </p>

          <ul>
            <li>Fraud</li>
            <li>Security incidents</li>
            <li>Unauthorized account access</li>
            <li>Abuse or misuse of the Services</li>
            <li>Potential violations of our Terms</li>
            <li>Threats to Bullionaire, users, or other persons</li>
          </ul>

          <h3>13.5 Business Transactions</h3>

          <p>
            Personal information may be disclosed, transferred, or reviewed as
            part of an actual or proposed merger, acquisition, financing,
            investment, restructuring, bankruptcy, reorganization, asset sale,
            change of control, due diligence process, or similar corporate
            transaction.
          </p>

          <p>
            A successor or acquiring entity may receive personal information as
            part of the applicable transaction, subject to applicable law.
          </p>

          <h3>13.6 Professional Advisers</h3>

          <p>
            We may disclose information to attorneys, accountants, auditors,
            insurers, financial advisers, consultants, and other professional
            advisers where reasonably necessary for legitimate business,
            compliance, risk-management, or legal purposes.
          </p>
        </section>

        <section>
          <h2>14. Categories of Third Parties</h2>

          <p>
            Depending on the circumstances described in this Privacy Policy,
            categories of third parties to which personal information may be
            disclosed include:
          </p>

          <ul>
            <li>Cloud and hosting providers</li>
            <li>Database and infrastructure providers</li>
            <li>Authentication providers</li>
            <li>Communications and email providers</li>
            <li>Analytics and performance providers</li>
            <li>Security and fraud-prevention providers</li>
            <li>Payment processors</li>
            <li>Customer-support providers</li>
            <li>Professional advisers</li>
            <li>
              Third-party services you affirmatively choose to connect or use
            </li>
            <li>
              Governmental authorities or other recipients where disclosure is
              legally required or permitted
            </li>
            <li>
              Potential or actual purchasers, investors, successors, or
              transaction participants in a corporate transaction
            </li>
          </ul>
        </section>

        <section>
          <h2>15. Aggregated and Deidentified Information</h2>

          <p>
            We may create aggregated, statistical, or deidentified information
            from information collected through the Services.
          </p>

          <p>
            We may use or disclose information that does not identify and cannot
            reasonably be linked to an identifiable individual for research,
            analytics, product improvement, security, business planning, and
            other lawful purposes.
          </p>

          <p>
            Where we rely on information as deidentified under applicable
            privacy law, we will maintain and use that information in
            deidentified form and will not attempt to reidentify it except as
            permitted by applicable law, including where necessary to test
            whether our deidentification processes are effective.
          </p>
        </section>

        <section>
          <h2>16. Data Minimization</h2>

          <p>
            We seek to collect and process personal information that is
            reasonably relevant and appropriate for the purposes described in
            this Privacy Policy.
          </p>

          <p>
            We may modify our collection practices over time to reduce
            unnecessary data collection, improve security, or accommodate
            changes in the Services.
          </p>

          <p>
            You should avoid providing personal information that is not
            reasonably necessary for the feature or communication you are using.
          </p>
        </section>

        <section>
          <h2>17. Data Retention</h2>

          <p>
            We retain personal information for as long as reasonably necessary
            for the purposes for which it was collected or another legitimate
            and lawful purpose.
          </p>

          <p>
            Retention periods may depend on factors such as:
          </p>

          <ul>
            <li>The type and sensitivity of the information</li>
            <li>The reason the information was collected</li>
            <li>Whether your account remains active</li>
            <li>
              Whether the information is necessary to provide a requested
              Service
            </li>
            <li>Security and fraud-prevention requirements</li>
            <li>Contractual requirements</li>
            <li>Accounting or tax requirements</li>
            <li>Applicable statutes of limitation</li>
            <li>Potential or actual disputes</li>
            <li>Legal and regulatory obligations</li>
          </ul>

          <p>
            Account information may generally be retained while your account
            remains active and for a reasonable period afterward where
            necessary for security, recordkeeping, dispute resolution, legal
            compliance, or other legitimate purposes.
          </p>

          <p>
            Transaction and subscription records may be retained as necessary
            for accounting, financial reporting, tax, fraud-prevention, and
            legal purposes.
          </p>

          <p>
            Security, diagnostic, and system logs may be retained for periods
            reasonably necessary to maintain and protect the Services.
          </p>

          <p>
            Communications may be retained for as long as reasonably necessary
            to respond to requests, maintain records, improve support, or
            protect legal rights.
          </p>

          <p>
            When personal information is no longer reasonably necessary, we may
            delete, anonymize, aggregate, or otherwise dispose of it as
            appropriate and as required by applicable law.
          </p>

          <p>
            Information may remain temporarily in backups, disaster-recovery
            systems, archives, logs, or other systems after deletion from active
            systems until those systems are overwritten, rotated, or otherwise
            processed in accordance with our ordinary retention practices.
          </p>
        </section>

        <section>
          <h2>18. Data Security</h2>

          <p>
            Bullionaire uses reasonable administrative, technical, and
            organizational measures designed to protect personal information
            against unauthorized access, acquisition, destruction, loss,
            alteration, or disclosure.
          </p>

          <p>
            Security measures may include access controls, authentication,
            logging, monitoring, infrastructure protections, vendor controls,
            and other safeguards appropriate to the nature of the information
            and our Services.
          </p>

          <p>
            No website, database, network, software system, storage platform, or
            method of electronic transmission can be guaranteed to be
            completely secure.
          </p>

          <p>
            Accordingly, although we take reasonable steps designed to protect
            personal information, we cannot guarantee the absolute security of
            information transmitted to, processed by, or stored through
            Bullionaire.
          </p>

          <p>
            You are responsible for maintaining the security of your own
            devices, email account, login credentials, and Bullionaire account.
          </p>

          <p>
            If we determine that a security incident requires notification
            under applicable law, we will provide legally required notices to
            affected individuals, governmental authorities, or others as
            required by applicable law.
          </p>
        </section>

        <section>
          <h2>19. Your Privacy Rights</h2>

          <p>
            Depending on where you live and the privacy laws applicable to
            Bullionaire, you may have some or all of the following rights
            regarding your personal information:
          </p>

          <ul>
            <li>
              Confirm whether Bullionaire is processing personal information
              about you
            </li>
            <li>Request access to personal information about you</li>
            <li>Request correction of inaccurate personal information</li>
            <li>Request deletion of certain personal information</li>
            <li>
              Request a portable copy of certain personal information where
              applicable
            </li>
            <li>
              Obtain information regarding categories of personal information
              collected
            </li>
            <li>
              Obtain information regarding the purposes for which information
              is used
            </li>
            <li>
              Obtain information regarding categories of third parties to which
              information is disclosed
            </li>
            <li>
              Opt out of certain sales of personal information where applicable
            </li>
            <li>
              Opt out of certain targeted advertising where applicable
            </li>
            <li>
              Opt out of certain legally significant profiling where applicable
            </li>
            <li>
              Limit certain uses or disclosures of sensitive personal
              information where applicable
            </li>
            <li>
              Appeal certain decisions regarding privacy requests where
              applicable
            </li>
            <li>
              Exercise privacy rights without unlawful discrimination or
              retaliation
            </li>
          </ul>

          <p>
            These rights are not absolute. Applicable law may permit or require
            Bullionaire to retain or continue processing certain information
            despite a request, including for security, fraud prevention,
            compliance, recordkeeping, legal claims, or other legally permitted
            purposes.
          </p>
        </section>

        <section>
          <h2>20. How to Exercise Your Privacy Rights</h2>

          <p>
            You may submit a privacy request by contacting us at{" "}
            <a href="mailto:info@bullionaireiq.com">
              info@bullionaireiq.com
            </a>
            .
          </p>

          <p>
            Please clearly identify your request as a privacy request and
            describe the right you wish to exercise.
          </p>

          <p>
            You do not need to create a new Bullionaire account solely to
            submit a privacy request.
          </p>

          <p>
            If you already have a Bullionaire account, we may use information
            associated with that account to authenticate your request.
          </p>

          <p>
            We may request information reasonably necessary to verify your
            identity, locate relevant records, prevent fraudulent requests, and
            determine whether you are entitled to exercise the requested right.
          </p>

          <p>
            We will use information provided for verification primarily for the
            purpose of verifying and responding to the request or as otherwise
            permitted by law.
          </p>

          <p>
            We may decline or limit a request where permitted by applicable
            law, including where we cannot reasonably verify the request, the
            request is fraudulent, an exception applies, or the request is
            manifestly unfounded, excessive, or repetitive.
          </p>

          <p>
            Where required by law, we will explain the reason for denying a
            request.
          </p>
        </section>

        <section>
          <h2>21. Authorized Agents</h2>

          <p>
            Where applicable law permits you to use an authorized agent to
            exercise a privacy right on your behalf, Bullionaire may require
            reasonable evidence that the agent has authority to act for you.
          </p>

          <p>
            We may also take reasonable steps to verify your identity or confirm
            that you authorized the agent, except where applicable law provides
            otherwise.
          </p>

          <p>
            Where applicable law recognizes qualifying browser settings,
            extensions, device settings, global privacy signals, or similar
            technology as an authorized method of exercising certain opt-out
            rights, Bullionaire will process qualifying requests as required by
            applicable law.
          </p>
        </section>

        <section>
          <h2>22. Appeals</h2>

          <p>
            If applicable privacy law gives you the right to appeal a decision
            we make regarding your privacy request, you may submit an appeal by
            emailing{" "}
            <a href="mailto:info@bullionaireiq.com">
              info@bullionaireiq.com
            </a>
            .
          </p>

          <p>
            Please identify the communication as a "Privacy Appeal," describe
            the original request, and explain why you believe the decision
            should be reconsidered.
          </p>

          <p>
            We will review and respond to qualifying appeals within the period
            required by applicable law.
          </p>

          <p>
            If applicable law requires us to provide information about how to
            contact a state attorney general, privacy regulator, supervisory
            authority, or other agency after an appeal is denied, we will
            provide that information in our response.
          </p>
        </section>

        <section>
          <h2>23. Texas Privacy Rights</h2>

          <p>
            If the Texas Data Privacy and Security Act applies to our processing
            of your personal data, Texas residents may have rights provided
            under that law, subject to its scope, exemptions, limitations, and
            verification requirements.
          </p>

          <p>
            These rights may include rights to:
          </p>

          <ul>
            <li>Confirm whether we process your personal data</li>
            <li>Access your personal data</li>
            <li>Correct inaccuracies</li>
            <li>Delete qualifying personal data</li>
            <li>
              Obtain a portable copy of certain personal data you previously
              provided
            </li>
            <li>
              Opt out of qualifying targeted advertising, sales of personal
              data, or legally significant profiling
            </li>
            <li>Appeal certain decisions concerning a privacy request</li>
          </ul>

          <p>
            Bullionaire will not unlawfully discriminate against you for
            exercising rights available under applicable Texas privacy law.
          </p>

          <p>
            As described above, requests may be submitted to{" "}
            <a href="mailto:info@bullionaireiq.com">
              info@bullionaireiq.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2>24. California Privacy Rights</h2>

          <p>
            To the extent the California Consumer Privacy Act, as amended
            ("CCPA"), applies to Bullionaire and to your personal information,
            California residents may have additional rights subject to
            applicable exceptions and verification requirements.
          </p>

          <p>
            These may include rights to request:
          </p>

          <ul>
            <li>
              The categories of personal information Bullionaire has collected
            about you
            </li>
            <li>
              The categories of sources from which that information was
              collected
            </li>
            <li>
              The business or commercial purposes for collecting, using, or
              disclosing the information
            </li>
            <li>
              The categories of third parties to whom information was disclosed
            </li>
            <li>Specific pieces of qualifying personal information</li>
            <li>Deletion of qualifying personal information</li>
            <li>Correction of inaccurate personal information</li>
            <li>
              Opt-out of qualifying sales or sharing of personal information
            </li>
            <li>
              Limitation of certain uses or disclosures of sensitive personal
              information where applicable
            </li>
          </ul>

          <p>
            California residents also have the right not to receive unlawful
            discriminatory treatment for exercising rights provided by the
            CCPA.
          </p>

          <p>
            As of the Effective Date, Bullionaire does not sell personal
            information for monetary consideration and does not currently use
            personal information collected through the core Services for
            cross-context behavioral advertising.
          </p>

          <p>
            If our practices change in a manner that triggers a legally required
            "Do Not Sell or Share My Personal Information" mechanism or similar
            control, we will provide the required mechanism.
          </p>
        </section>

        <section>
          <h2>25. No Unlawful Discrimination for Privacy Requests</h2>

          <p>
            Bullionaire will not unlawfully discriminate against you because
            you exercise a privacy right provided by applicable law.
          </p>

          <p>
            Exercising a privacy right may, however, affect our ability to
            provide a feature where the information at issue is reasonably
            necessary to provide that feature.
          </p>

          <p>
            For example, deletion of your account information may make it
            impossible to continue providing account-based Services to you.
          </p>
        </section>

        <section>
          <h2>26. Children's and Minors' Privacy</h2>

          <p>
            Bullionaire is intended for adults. You must be at least eighteen
            (18) years old and at least the age of legal majority in your
            jurisdiction to create an account or use account-based Bullionaire
            Services.
          </p>

          <p>
            Bullionaire is not directed to children under thirteen (13), and we
            do not knowingly seek to collect personal information online from
            children under thirteen.
          </p>

          <p>
            We also do not knowingly permit individuals under eighteen to
            maintain Bullionaire user accounts where our Terms require users to
            be eighteen or older.
          </p>

          <p>
            If we learn that an ineligible minor has created an account or
            provided personal information in violation of our eligibility
            requirements, we may suspend or terminate the account and take
            reasonable steps to delete or otherwise appropriately process the
            information, subject to applicable law and legitimate retention
            requirements.
          </p>

          <p>
            A parent or legal guardian who believes that a child has provided
            personal information to Bullionaire may contact us at{" "}
            <a href="mailto:info@bullionaireiq.com">
              info@bullionaireiq.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2>27. Third-Party Websites and Services</h2>

          <p>
            Bullionaire may contain links to or information regarding
            third-party websites, prediction markets, exchanges, brokers,
            financial institutions, data providers, social networks, or other
            services.
          </p>

          <p>
            If you visit or interact with a third-party service, that third
            party may independently collect information from you.
          </p>

          <p>
            Bullionaire does not control and is not responsible for the privacy,
            data security, data-retention, cookie, tracking, or other practices
            of third-party services.
          </p>

          <p>
            You should review the privacy policy and terms of any third-party
            service before providing information to or using that service.
          </p>
        </section>

        <section>
          <h2>28. International Users and Data Transfers</h2>

          <p>
            Bullionaire is operated from the United States, and our service
            providers may process or store information in the United States or
            other jurisdictions.
          </p>

          <p>
            If you access the Services from outside the United States, your
            personal information may be transferred to and processed in
            jurisdictions whose data-protection laws may differ from those in
            your place of residence.
          </p>

          <p>
            Where applicable law imposes requirements on international
            transfers of personal information, we will use transfer mechanisms
            or other safeguards required by applicable law where applicable to
            our processing.
          </p>

          <p>
            If privacy laws in your jurisdiction apply to our processing, you
            may have additional rights, which can include rights of access,
            correction, deletion, restriction, portability, objection,
            withdrawal of consent where processing relies on consent, or the
            right to submit a complaint to an applicable data-protection
            authority.
          </p>
        </section>

        <section>
          <h2>29. Legal Bases Where Required</h2>

          <p>
            In jurisdictions that require us to identify a legal basis for
            processing personal information, our legal bases may include, as
            applicable:
          </p>

          <ul>
            <li>
              Performance of a contract or taking steps requested by you before
              entering into a contract
            </li>
            <li>
              Our legitimate interests in operating, securing, supporting,
              developing, and improving Bullionaire
            </li>
            <li>Compliance with legal obligations</li>
            <li>Protection of our rights and the rights of others</li>
            <li>Your consent where consent is required or appropriate</li>
          </ul>

          <p>
            The particular legal basis depends on the type of information and
            purpose for which it is processed.
          </p>
        </section>

        <section>
          <h2>30. Business Transfers and Changes of Ownership</h2>

          <p>
            If Bullionaire is involved in a merger, acquisition, financing,
            restructuring, reorganization, bankruptcy, sale of assets, or other
            change in ownership or control, personal information may be
            transferred or disclosed as part of evaluating, negotiating,
            completing, or implementing that transaction.
          </p>

          <p>
            Any successor's handling of personal information will remain
            subject to applicable law.
          </p>

          <p>
            If a successor proposes a materially different use of personal
            information that requires additional notice or consent under
            applicable law, appropriate notice or consent will be provided.
          </p>
        </section>

        <section>
          <h2>31. Legal Preservation</h2>

          <p>
            We may preserve information beyond our ordinary retention period if
            we reasonably believe preservation is necessary in connection with
            litigation, an investigation, a legal hold, a regulatory inquiry,
            fraud, a security incident, enforcement of our agreements, or
            another legal or compliance matter.
          </p>

          <p>
            Information subject to a legal preservation obligation may be
            retained until the applicable obligation has ended, even if you
            otherwise request deletion.
          </p>
        </section>

        <section>
          <h2>32. Changes to This Privacy Policy</h2>

          <p>
            We may update this Privacy Policy from time to time to reflect
            changes in our Services, technology, business practices, service
            providers, legal requirements, or other circumstances.
          </p>

          <p>
            When we update this Privacy Policy, we will revise the "Last
            Updated" date at the top of this page.
          </p>

          <p>
            If we make a material change, we may provide additional notice
            through Bullionaire, by email, through an account notice, during
            login, or through another reasonable method as required by
            applicable law.
          </p>

          <p>
            We will not rely solely on a change to this Privacy Policy to obtain
            consent for a materially different processing activity where
            applicable law requires affirmative consent.
          </p>
        </section>

        <section>
          <h2>33. Relationship to the Terms of Service</h2>

          <p>
            Your use of Bullionaire is also governed by our Terms of Service.
          </p>

          <p>
            To the extent permitted by applicable law, disputes arising out of
            or relating to the Services, these Terms, or this Privacy Policy may
            be subject to the dispute-resolution provisions contained in the
            Terms of Service, including applicable arbitration provisions.
          </p>

          <p>
            Nothing in this Privacy Policy or the Terms of Service is intended
            to waive or limit a privacy right or remedy that cannot lawfully be
            waived or limited.
          </p>
        </section>

        <section>
          <h2>34. Contact Us</h2>

          <p>
            If you have questions about this Privacy Policy, our privacy
            practices, or personal information associated with you, or if you
            would like to submit a privacy request or appeal, contact us at{" "}
            <a href="mailto:info@bullionaireiq.com">
              info@bullionaireiq.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}