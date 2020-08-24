package org.edu_sharing.repository.server;

import org.alfresco.service.cmr.repository.NodeRef;
import org.alfresco.service.cmr.repository.StoreRef;
import org.apache.commons.io.FileUtils;
import org.apache.log4j.Logger;
import org.edu_sharing.repository.client.tools.CCConstants;
import org.edu_sharing.repository.server.tools.ApplicationInfo;
import org.edu_sharing.repository.server.tools.ApplicationInfoList;
import org.edu_sharing.repository.server.tools.LRMITool;
import org.edu_sharing.service.license.LicenseService;
import org.edu_sharing.service.nodeservice.NodeServiceHelper;
import org.json.JSONObject;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.File;
import java.io.IOException;
import java.net.URL;

public class NgServlet extends HttpServlet {
	public static final String COMPONENTS_RENDER = "components/render/";
	public static final String COMPONENTS_ERROR = "components/error/";
	private static Logger logger = Logger.getLogger(NgServlet.class);

	public static final String PREVIOUS_ANGULAR_URL = "PREVIOUS_ANGULAR_URL";

	@Override
	protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
		try {
			ApplicationInfo home = ApplicationInfoList.getHomeRepository();
			String head=home.getCustomHtmlHeaders();
			// store url for shibboleth/sso, regardless if login is present or not (for guest redirects)
			req.getSession().setAttribute(PREVIOUS_ANGULAR_URL,
					req.getRequestURI() +( req.getQueryString() != null ? "?"+req.getQueryString() : ""));
			File index=new File(req.getSession().getServletContext().getRealPath("index.html"));
			String html=FileUtils.readFileToString(index);
			if(head!=null) {
				html = addToHead(head, html);
			}
			URL url = new URL(req.getRequestURL().toString());
			if(url.getPath().contains(COMPONENTS_RENDER)){
				html = addLicenseMetadata(html,url);
				html = addLRMI(html,url);
			}
			if(req.getHeader("User-Agent")!=null){
			    String platform="";
                if(req.getHeader("User-Agent").contains("ios"))
                    platform="ios";
                if(req.getHeader("User-Agent").contains("android"))
                    platform="android";
				if(req.getHeader("User-Agent").contains("cordova / edu-sharing-app")){
                    html=addToHead("<script type=\"text/javascript\" src=\"assets/cordova/"+platform+"/cordova.js\"></script>",html);
                    logger.info("cordova app, add cordova.js to header");
                }
				if (req.getHeader("User-Agent").contains("ionic / edu-sharing-app")) {
					// when using ionic, our app-registry will care for delivering the right plattform data
					String[] headers=req.getHeader("User-Agent").split("\\/");
                    String version=headers[headers.length-1].trim();
                    if(!version.matches("\\d\\.\\d(\\.\\d)?"))
                        version="0.0.0";
					html =addToHead("<script type=\"text/javascript\" src=\"https://app-registry.edu-sharing.com/js/"+version+"/"+platform+"/cordova.js\"></script>",html);
					logger.info("ionic app, add cordova.js to header");
				}
			}
			resp.setHeader("Content-Type","text/html");
			resp.getOutputStream().write(html.getBytes("UTF-8"));
		}catch(Throwable t) {
			t.printStackTrace();
			resp.sendError(500, "Fatal error preparing index.html: "+t.getMessage());
		}
	}

	private String addLicenseMetadata(String html, URL url) {
		try {
			String nodeId = getNodeFromURL(url);
			NodeRef ref = new NodeRef(StoreRef.STORE_REF_WORKSPACE_SPACESSTORE, nodeId);
			String licenseUrl=new LicenseService().getLicenseUrl(
					NodeServiceHelper.getProperty(ref,CCConstants.CCM_PROP_IO_COMMONLICENSE_KEY),
					NodeServiceHelper.getProperty(ref,CCConstants.CCM_PROP_IO_COMMONLICENSE_CC_LOCALE),
					NodeServiceHelper.getProperty(ref,CCConstants.CCM_PROP_IO_COMMONLICENSE_CC_VERSION)
			);
			if(licenseUrl!=null) {
				String data = "<link rel=\"license\" href=\"" + licenseUrl + "\">";
				return addToHead(data, html);
			}
		}catch(Throwable t){
			logger.error("Failed to load node license for attaching to head:",t);
		}
		return html;	}

	private String addLRMI(String html, URL url) {
		try {
			String nodeId = getNodeFromURL(url);
			JSONObject lrmi = LRMITool.getLRMIJson(nodeId);
			String data = "<script type=\"application/ld+json\">";
			data += lrmi.toString(2);
			data += "</script>";
			return addToHead(data, html);
		}catch(Throwable t){
			logger.error("Failed to load node properties for attaching LRMI data:",t);
		}
		return html;
	}

	private String getNodeFromURL(URL url) {
		String[] path = url.getPath().split("/");
		return path[path.length - 1];
	}

	private String addToHead(String head, String html) {
		int pos=html.indexOf("</head>");
		html=html.substring(0,pos)+head+html.substring(pos);
		return html;
	}
}
