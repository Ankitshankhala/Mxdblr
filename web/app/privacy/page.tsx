/**
 * Privacy Policy (route: /privacy).
 *
 * TODO(legal): this text was drafted from what the application actually does —
 * every category of data named below was taken from the Prisma models (Dealer,
 * OtpCode, CartItem, InquiryLog, NotificationSubscription) and the auth routes,
 * so it is factually accurate about our processing. It has NOT been reviewed by
 * a lawyer. Have it checked before relying on it in any dispute.
 */
import type { Metadata } from 'next';
import LegalPage, { Clause } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How MXD® Wholesale collects, uses and protects the information of registered dealers.',
};

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '919029363910';

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="MXD® Wholesale is a business-to-business platform for registered dealers. This policy explains what information we collect when you register and order, why we collect it, who we share it with, and the choices you have."
    >
      <Clause heading="Who this policy covers">
        <p>
          This policy applies to dealers and prospective dealers who use the MXD® Wholesale portal.
          We do not sell to the general public, and we do not knowingly collect information from
          anyone under 18.
        </p>
      </Clause>

      <Clause heading="Information we collect">
        <p>When you register as a dealer, we collect:</p>
        <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
          <li>Your name and your shop or business name</li>
          <li>Your mobile number and WhatsApp number, and an alternate mobile number if you give one</li>
          <li>Your business address — city, tehsil, district, state, country and PIN code</li>
          <li>Your business type (retail shop or wholesaler)</li>
          <li>Your GST number, where you provide one</li>
        </ul>
        <p>
          As you use the portal we also record the items you add to your cart, the inquiries you
          send us, and any stock notifications you subscribe to. Administrative actions taken on
          your account by our staff are logged.
        </p>
        <p>
          We do <strong>not</strong> collect or store payment card details. Pricing and payment are
          agreed directly with our team outside the portal.
        </p>
      </Clause>

      <Clause heading="Mobile number verification">
        <p>
          We verify your mobile number by sending a one-time password (OTP). The OTP is stored only
          in hashed form, is valid for a short period, and is marked as used once redeemed. We keep
          your mobile number because it is how you sign in and how we reach you about your orders.
        </p>
      </Clause>

      <Clause heading="Why we use your information">
        <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
          <li>To verify that you are a genuine trade buyer and to operate your dealer account</li>
          <li>To respond to your inquiries and confirm pricing, stock and dispatch</li>
          <li>To arrange delivery to your business address</li>
          <li>To send stock and order notifications you have asked for</li>
          <li>To meet our tax and record-keeping obligations, including GST requirements</li>
        </ul>
        <p>
          We do not sell your information, and we do not use it for advertising by third parties.
        </p>
      </Clause>

      <Clause heading="Service area">
        <p>
          Dealer registration is currently limited to defined states. If you register from outside
          our service area your application will be declined, and the details you submitted are not
          used for any other purpose.
        </p>
      </Clause>

      <Clause heading="Who we share information with">
        <p>We share information only where it is needed to run the service:</p>
        <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
          <li>
            <strong>Messaging providers</strong> — we use MSG91 to deliver OTP and WhatsApp
            messages, which requires sharing your mobile number with them for delivery.
          </li>
          <li>
            <strong>WhatsApp</strong> — when you send an inquiry, the contents of that inquiry are
            transmitted through WhatsApp and are subject to WhatsApp&rsquo;s own privacy terms.
          </li>
          <li>
            <strong>Hosting and media providers</strong> — our infrastructure and image hosting
            providers process data on our behalf under contract.
          </li>
          <li>
            <strong>Authorities</strong> — where we are required to disclose information by law.
          </li>
        </ul>
      </Clause>

      <Clause heading="How long we keep it">
        <p>
          We keep dealer account records for as long as your account is active and afterwards for
          as long as tax and company law require us to retain trading records. Expired one-time
          passwords are removed automatically. You can ask us to close your account at any time.
        </p>
      </Clause>

      <Clause heading="Security">
        <p>
          Access to dealer data is restricted to authorised staff and is protected by
          authentication and role-based permissions. Administrative access is logged. No system is
          perfectly secure, but we take reasonable technical and organisational measures to protect
          your information.
        </p>
      </Clause>

      <Clause heading="Your rights">
        <p>
          You may ask us to confirm what information we hold about you, correct anything that is
          inaccurate, or delete your account and the personal information associated with it,
          subject to records we must keep by law. To make a request, contact us using the details
          below. We handle personal data in line with applicable Indian data protection law,
          including the Digital Personal Data Protection Act, 2023.
        </p>
      </Clause>

      <Clause heading="Cookies and local storage">
        <p>
          We use browser storage to keep you signed in and to remember your cart between visits.
          These are necessary for the portal to function; we do not use third-party advertising or
          cross-site tracking cookies.
        </p>
      </Clause>

      <Clause heading="Changes to this policy">
        <p>
          If we change this policy we will update the date shown at the top of this page. Continued
          use of the portal after a change means you accept the updated policy.
        </p>
      </Clause>

      <Clause heading="Contact">
        <p>
          Questions about this policy, or requests about your information, can be sent to:
        </p>
        <p style={{ marginTop: 8 }}>
          <strong>MXD® Wholesale</strong>
          <br />
          Registered address: Shop No. 1008, Nagarthpete Cross Road, GVR Lane, Bengaluru 560002
          <br />
          Email:{' '}
          <a href="mailto:info@mxdblr.com" style={{ color: '#F47920' }}>
            info@mxdblr.com
          </a>
          <br />
          WhatsApp:{' '}
          <a href={`https://wa.me/${WHATSAPP}`} style={{ color: '#F47920' }}>
            +{WHATSAPP}
          </a>
        </p>
      </Clause>
    </LegalPage>
  );
}
