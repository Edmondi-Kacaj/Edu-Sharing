/**
 *
 *  
 * 
 * 
 *	
 *
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 *
 */
package org.edu_sharing.repository.server.jobs.quartz;

import org.alfresco.service.ServiceRegistry;
import org.alfresco.service.namespace.QName;
import org.apache.commons.lang.StringUtils;
import org.apache.log4j.Logger;
import org.edu_sharing.alfrescocontext.gate.AlfAppContextGate;
import org.edu_sharing.repository.client.tools.CCConstants;
import org.edu_sharing.repository.server.jobs.helper.NodeRunner;
import org.edu_sharing.service.nodeservice.RecurseMode;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;
import org.springframework.context.ApplicationContext;

import java.io.Serializable;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Batch edit property for multiple nodes
 * Required parameters:
 * property: The property name to replace
 * value: the target value to set
 * OR copy: the source property to copy the value of
 * startFolder: The id of the folder to start (recursively processing all children)
 * mode: The mode, see enum
 * types: the types of nodes to process, e.g. ccm:io (comma seperated string)
 *
 */
public class BulkEditNodesJob extends AbstractJob{

	protected Logger logger = Logger.getLogger(BulkEditNodesJob.class);
	private org.alfresco.service.cmr.repository.NodeService nodeService;
	private String property;
	private Serializable value;
	private String copy;
	private Mode mode;
	private List<String> types;

	private enum Mode{
		Replace,
		Append,
		Remove
	};

	@Override
	public void execute(JobExecutionContext context) throws JobExecutionException {

		ApplicationContext applicationContext = AlfAppContextGate.getApplicationContext();

		ServiceRegistry serviceRegistry = (ServiceRegistry) applicationContext.getBean(ServiceRegistry.SERVICE_REGISTRY);

		nodeService = serviceRegistry.getNodeService();
		
		property = (String) context.getJobDetail().getJobDataMap().get("property");
		if(property==null){
			throw new IllegalArgumentException("Missing required parameter 'property'");
		}
		property = CCConstants.getValidGlobalName(property);

		copy = (String) context.getJobDetail().getJobDataMap().get("copy");
		if(copy!=null){
			copy=CCConstants.getValidGlobalName(copy);
		}
		value = (String) context.getJobDetail().getJobDataMap().get("value");
		if(copy==null && value==null){
			throw new IllegalArgumentException("Missing one of the required parameters 'value' or 'copy'");
		}
		if(copy!=null && value!=null){
			throw new IllegalArgumentException("Only one of parameters 'value' and 'copy' may be set");
		}

		String lucene = (String) context.getJobDetail().getJobDataMap().get("lucene");

		String startFolder = (String) context.getJobDetail().getJobDataMap().get("startFolder");
		if(startFolder==null && (lucene == null || lucene.trim().equals(""))){
			throw new IllegalArgumentException("Missing required parameter 'startFolder' or 'lucene'");
		}
		try {
			types = Arrays.stream(((String) context.getJobDetail().getJobDataMap().get("types")).
					split(",")).map(String::trim).map(CCConstants::getValidGlobalName).
					collect(Collectors.toList());
		}catch(Throwable t){}
		if(types==null || types.isEmpty()) {
			throw new IllegalArgumentException("Missing required parameter 'types'");
		}

		try {
			mode = Mode.valueOf((String) context.getJobDetail().getJobDataMap().get("mode"));
		}catch(Throwable t){
			throw new IllegalArgumentException("Missing or invalid value for required parameter 'mode'",t);
		}
		RecurseMode recurseMode = RecurseMode.Folders;
		try {
			if(context.getJobDetail().getJobDataMap().get("recurseMode") != null) {
				recurseMode = RecurseMode.valueOf((String) context.getJobDetail().getJobDataMap().get("recurseMode"));
			}
		}catch(Throwable t){
			if(lucene == null || lucene.trim().equals(""))
				throw new IllegalArgumentException("Missing or invalid value for parameter 'recurseMode'",t);
		}
		NodeRunner runner = new NodeRunner();
		runner.setTask((ref)->{
			org.alfresco.service.cmr.repository.NodeRef nodeRef = new org.alfresco.service.cmr.repository.NodeRef(ref.getStoreRef(), ref.getId());
			logger.info("Bulk edit metadata for node "+ref.getId());
			if(copy!=null){
				value=nodeService.getProperty(nodeRef,QName.createQName(copy));
			}
			if(mode.equals(Mode.Replace)){
				nodeService.setProperty(nodeRef,QName.createQName(property),value);
			}
			else if(mode.equals(Mode.Remove)){
				nodeService.removeProperty(nodeRef,QName.createQName(property));
			}
			else {
				throw new IllegalArgumentException("Mode " + mode + " is currently not supported");
			}
		});
		runner.setTypes(types);
		runner.setRunAsSystem(true);
		runner.setThreaded(false);
		runner.setRecurseMode(recurseMode);
		runner.setStartFolder(startFolder);
		runner.setLucene(lucene);
		runner.setKeepModifiedDate(true);
		runner.setTransaction(NodeRunner.TransactionMode.Local);
		int count=runner.run();
		logger.info("Processed "+count+" nodes");
	}
	
	public void run() {

	}
	
	@Override
	public Class[] getJobClasses() {
		// TODO Auto-generated method stub
		return allJobs;
	}
}
