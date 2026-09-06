/**
 * Terms of Service (route: /terms).
 *
 * TODO(legal): drafted to describe how the platform actually works — dealer-only
 * access, WhatsApp inquiry flow, no online payment, MOQ and GST requirements —
 * and reviewed against the registration and inquiry routes for accuracy. NOT
 * reviewed by a lawyer. Have it checked before relying on it.
 */
import type { Metadata } from 'next';
import LegalPage, { Clause } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms on which registered dealers may use the MXD® Wholesale portal.',
};

const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '919029363910';

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="These terms govern your use of the MXD® Wholesale portal. By registering as a dealer or placing an inquiry, you agree to them."
    >
      <Clause heading="Trade buyers only">
        <p>
          This portal is for businesses buying for resale. Registration requires genuine shop or
          business details, and we may ask for a valid GST number. We may decline or revoke any
          registration at our discretion, including where the details given cannot be verified.
        </p>
      </Clause>

      <Clause heading="Your account">
        <p>
          Access is tied to your verified mobile number. You are responsible for activity on your
          account and for keeping access to your registered number secure. Tell us promptly if you
          believe your account is being used by someone else.
        </p>
      </Clause>

      <Clause heading="Service area">
        <p>
          We currently serve dealers in defined states within India. Registrations from outside the
          service area will be declined.
        </p>
      </Clause>

      <Clause heading="Pricing and inquiries">
        <p>
          The portal is an inquiry and catalogue system, not a checkout. Adding items to your cart
          and sending an inquiry does not create a binding order. Prices are confirmed by our team
          in response to your inquiry and are valid only for the period stated in that response.
          Wholesale pricing is available to registered dealers and is confidential to them.
        </p>
      </Clause>

      <Clause heading="Minimum order quantities">
        <p>
          Products carry a minimum order quantity, shown on each product. Orders below the stated
          minimum for an item cannot be fulfilled.
        </p>
      </Clause>

      <Clause heading="Stock and product information">
        <p>
          We work to keep catalogue information accurate, but stock status, specifications and
          images are indicative and may change without notice. Availability is confirmed at the
          point we respond to your inquiry.
        </p>
      </Clause>

      <Clause heading="Dispatch and delivery">
        <p>
          Dispatch timelines quoted on the site are targets and depend on order confirmation,
          payment and stock availability. Risk in the goods passes on delivery to you or your
          nominated carrier.
        </p>
      </Clause>

      <Clause heading="Payment">
        <p>
          Payment is arranged directly with our team; the portal does not process payments and does
          not store payment card details. Goods remain our property until paid for in full.
        </p>
      </Clause>

      <Clause heading="Returns">
        <p>
          Damaged or defective goods must be reported within the period we confirm with your order,
          with supporting evidence. Goods returned must be unused and in original packaging. This
          does not affect rights you have under applicable law.
        </p>
      </Clause>

      <Clause heading="Acceptable use">
        <p>
          Do not use the portal to scrape or bulk-extract catalogue data, to resell access, to
          disclose dealer pricing to the general public, or to interfere with the operation or
          security of the service.
        </p>
      </Clause>

      <Clause heading="Liability">
        <p>
          To the extent permitted by law, we are not liable for indirect or consequential loss,
          including loss of profit or business, arising from use of the portal. Nothing in these
          terms excludes liability that cannot lawfully be excluded.
        </p>
      </Clause>

      <Clause heading="Changes">
        <p>
          We may update these terms; the date at the top of this page shows when they last changed.
          Continued use after a change means you accept the updated terms.
        </p>
      </Clause>

      <Clause heading="Governing law">
        <p>
          These terms are governed by the laws of India, and the courts at Bengaluru shall
          have exclusive jurisdiction.
        </p>
      </Clause>

      <Clause heading="Contact">
        <p>
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
